
(function () {
  'use strict';
  var app = {
    isLoading: true,
    visibleCards: {},
    selectedCities: [],
    spinner: document.querySelector('.loader'),
    cardTemplate: document.querySelector('.cardTemplate'),
    container: document.querySelector('.main'),
    addDialog: document.querySelector('.dialog-container'),
    daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  };


  /*****************************************************************************
   *
   * Event listeners for UI elements
   *
   ****************************************************************************/

  document.getElementById('butRefresh').addEventListener('click', function () {
    // Refresh all of the forecasts
    app.updateForecasts();
  });

  document.getElementById('butAdd').addEventListener('click', function () {
    // Open/show the add new city dialog
    app.toggleAddDialog(true);
  });

  document.getElementById('butAddCity').addEventListener('click', function () {
    // Add the newly selected city
    var select = document.getElementById('selectCityToAdd');
    var selected = select.options[select.selectedIndex];
    var key = selected.value;
    var label = selected.textContent;
    if (!app.selectedCities) {
      app.selectedCities = [];
    }
    app.getForecast(key, label);
    app.selectedCities.push({ key, label });
    app.saveSelectedCities();
    app.toggleAddDialog(false);
  });

  document.getElementById('butAddCancel').addEventListener('click', function () {
    // Close the add new city dialog
    app.toggleAddDialog(false);
  });


  /*****************************************************************************
   *
   * Methods to update/refresh the UI
   *
   ****************************************************************************/

  // Toggles the visibility of the add new city dialog.
  app.toggleAddDialog = function (visible) {
    if (visible) {
      app.addDialog.classList.add('dialog-container--visible');
    } else {
      app.addDialog.classList.remove('dialog-container--visible');
    }
  };

  // Updates a weather card with the latest weather forecast. If the card
  // doesn't already exist, it's cloned from the template.
  app.updateForecastCard = function (data) {
    var dataLastUpdated = new Date(data.created);
    var sunrise = data.current_observation.astronomy.sunrise;
    var sunset = data.current_observation.astronomy.sunset;
    var current = data.current_observation.condition;
    var humidity = data.current_observation.atmosphere.humidity;
    var wind = data.current_observation.wind;

    var card = app.visibleCards[data.key];
    if (card) {
      // remove old card
      const pNode = document.querySelector('main');
      const cNode = pNode.removeChild(card);
      card = undefined;
    };
    if (!card) {
      card = app.cardTemplate.cloneNode(true);
      card.classList.remove('cardTemplate');
      card.querySelector('.location').textContent = data.label;
      card.removeAttribute('hidden');
      app.container.appendChild(card);
      app.visibleCards[data.key] = card;
    }

    // Verifies the data provide is newer than what's already visible
    // on the card, if it's not bail, if it is, continue and update the
    // time saved in the card
    var cardLastUpdatedElem = card.querySelector('.card-last-updated');
    var cardLastUpdated = cardLastUpdatedElem.textContent;
    if (cardLastUpdated) {
      cardLastUpdated = new Date(cardLastUpdated);
      // Bail if the card has more recent data then the data
      if (dataLastUpdated.getTime() < cardLastUpdated.getTime()) {
        return;
      }
    }
    cardLastUpdatedElem.textContent = data.created;

    card.querySelector('.description').textContent = current.text;
    card.querySelector('.date').textContent = current.date;
    card.querySelector('.current .icon').classList.add(app.getIconClass(current.code));
    card.querySelector('.current .temperature .value').textContent =
      Math.round((current.temperature - 32) / 1.8000);
    card.querySelector('.current .sunrise').textContent = sunrise;
    card.querySelector('.current .sunset').textContent = sunset;
    card.querySelector('.current .humidity').textContent =
      Math.round(humidity) + '%';
    card.querySelector('.current .wind .value').textContent =
      Math.round(wind.speed * 1.609344);
    card.querySelector('.current .wind .direction').textContent = wind.direction;
    var nextDays = card.querySelectorAll('.future .oneday');
    var today = new Date();
    today = today.getDay();
    for (var i = 0; i < 7; i++) {
      var nextDay = nextDays[i];
      var daily = data.forecasts[i];
      if (daily && nextDay) {
        nextDay.querySelector('.date').textContent =
          app.daysOfWeek[(i + today) % 7];
        nextDay.querySelector('.icon').classList.add(app.getIconClass(daily.code));
        nextDay.querySelector('.temp-high .value').textContent =
          Math.round((daily.high - 32) / 1.8000);
        nextDay.querySelector('.temp-low .value').textContent =
          Math.round((daily.low - 32) / 1.8000);
      }
    }
    card.focus();
    if (app.isLoading) {
      app.spinner.setAttribute('hidden', false);
      app.container.removeAttribute('hidden');
      app.isLoading = false;
    }
  };


  /*****************************************************************************
   *
   * Methods for dealing with the model
   *
   ****************************************************************************/

  /*
   * Gets a forecast for a specific city and updates the card with the data.
   * getForecast() first checks if the weather data is in the cache. If so,
   * then it gets that data and populates the card with the cached data.
   * Then, getForecast() goes to the network for fresh data. If the network
   * request goes through, then the card gets updated a second time with the
   * freshest data.
   */
  app.getForecast = function (key, label, latitude, longitude) {

    let url = 'https://weather-ydn-yql.media.yahoo.com/forecastrss';
    let method = 'GET';
    let app_id = 'Xri1A47e';
    let consumer_key = 'your_consumer_key';
    let consumer_secret = 'your_consumer_secret';
    let concat = '&';
    let query = latitude && longitude ? { 'lat': latitude, 'lon': longitude, 'format': 'json' } : { 'location': label, 'format': 'json' };
    let oauth = {
      'oauth_consumer_key': consumer_key,
      'oauth_nonce': Math.random().toString(36).substring(2),
      'oauth_signature_method': 'HMAC-SHA1',
      'oauth_timestamp': parseInt(new Date().getTime() / 1000).toString(),
      'oauth_version': '1.0'
    };

    let merged = {};
    $.extend(merged, query, oauth);
    // Note the sorting here is required
    var merged_arr = Object.keys(merged).sort().map(function (k) {
      return [k + '=' + encodeURIComponent(merged[k])];
    });
    let signature_base_str = method
      + concat + encodeURIComponent(url)
      + concat + encodeURIComponent(merged_arr.join(concat));

    let composite_key = encodeURIComponent(consumer_secret) + concat;
    let hash = CryptoJS.HmacSHA1(signature_base_str, composite_key);
    let signature = hash.toString(CryptoJS.enc.Base64);

    oauth['oauth_signature'] = signature;
    let auth_header = 'OAuth ' + Object.keys(oauth).map(function (k) {
      return [k + '="' + oauth[k] + '"'];
    }).join(',');

    // TODO add cache logic here
    let networkDataReceived = false;
    if ('caches' in window) {
      /*
       * Check if the service worker has already cached this city's weather
       * data. If the service worker has the data, then display the cached
       * data while the app fetches the latest data.
       */
      const resource = url + '?' + $.param(query);
      caches.match(resource).then(function (response) {
        //don't overwrite network data
        if (response && !networkDataReceived) {
          response.json().then(function (results) {
            results.key = key || results.location.woeid;
            results.label = label || results.location.city + "," + results.location.country.slice(0, 2);
            app.updateForecastCard(results);
          });
        }
      }).catch(function (err) {
        console.error(err);

      })
    }
    // Fetch the latest data.
    $.ajax({
      url: url + '?' + $.param(query),
      headers: {
        'Authorization': auth_header,
        'X-Yahoo-App-Id': app_id
      },
      method: 'GET',
      success: function (data) {
        data.key = key || data.location.woeid;
        data.label = label || data.location.city + "," + data.location.country.slice(0, 2);
        data.created = data.current_observation.pubDate;
        networkDataReceived = true;
        app.updateForecastCard(data);
      },
    });
  };

  // Iterate all of the cards and attempt to get the latest forecast data
  app.updateForecasts = function () {
    var keys = Object.keys(app.visibleCards);
    keys.forEach(function (key) {
      app.getForecast(key);
    });
  };


  // Save list of cities to localStorage.
  app.saveSelectedCities = function () {
    var selectedCities = JSON.stringify(app.selectedCities);
    localStorage.selectedCities = selectedCities;
  };

  app.getIconClass = function (weatherCode) {
    // Weather codes: https://developer.yahoo.com/weather/documentation.html#codes
    weatherCode = parseInt(weatherCode);
    switch (weatherCode) {
      case 25: // cold
      case 32: // sunny
      case 33: // fair (night)
      case 34: // fair (day)
      case 36: // hot
      case 3200: // not available
        return 'clear-day';
      case 0: // tornado
      case 1: // tropical storm
      case 2: // hurricane
      case 6: // mixed rain and sleet
      case 8: // freezing drizzle
      case 9: // drizzle
      case 10: // freezing rain
      case 11: // showers
      case 12: // showers
      case 17: // hail
      case 35: // mixed rain and hail
      case 40: // scattered showers
        return 'rain';
      case 3: // severe thunderstorms
      case 4: // thunderstorms
      case 37: // isolated thunderstorms
      case 38: // scattered thunderstorms
      case 39: // scattered thunderstorms (not a typo)
      case 45: // thundershowers
      case 47: // isolated thundershowers
        return 'thunderstorms';
      case 5: // mixed rain and snow
      case 7: // mixed snow and sleet
      case 13: // snow flurries
      case 14: // light snow showers
      case 16: // snow
      case 18: // sleet
      case 41: // heavy snow
      case 42: // scattered snow showers
      case 43: // heavy snow
      case 46: // snow showers
        return 'snow';
      case 15: // blowing snow
      case 19: // dust
      case 20: // foggy
      case 21: // haze
      case 22: // smoky
        return 'fog';
      case 24: // windy
      case 23: // blustery
        return 'windy';
      case 26: // cloudy
      case 27: // mostly cloudy (night)
      case 28: // mostly cloudy (day)
      case 31: // clear (night)
        return 'cloudy';
      case 29: // partly cloudy (night)
      case 30: // partly cloudy (day)
      case 44: // partly cloudy
        return 'partly-cloudy-day';
    }
  };
  /**
   * Get user location to fetch current weather stats
   * function getUserLocation() checks if geolocation is enabled then gets 
   * the currentUser location's longtitude and latitude 
   * it then calls getForecast with lat and long
   */
  app.getUserLocation = function () {
    if (!("geolocation" in navigator)) {
      console.log("Geolocation api is not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(function (position) {
      // console.log("Showing weather for ", position);
      //passing undefined twice to skip key and label parameters
      app.getForecast(undefined, undefined, position.coords.latitude, position.coords.longitude)
    },
      function (err) {
        console.log("Can't retrieve user location", err);

      })
  };



  /*
   * Fake weather data that is presented when the user first uses the app,
   * or when the user has not saved any cities. See startup code for more
   * discussion.
   */
  var initialWeatherForecast = {
    key: '1528693',
    label: 'Nairobi, KE',
    created: '2017-12-20T08:23:12Z',
    current_observation: {
      astronomy: {
        sunrise: "5:43 am",
        sunset: "8:21 pm"
      },

      condition: {
        text: "Windy",
        date: "Thu, 21 Jul 2017 09:00 PM EAT",
        temperature: 56,
        code: 24
      },

      atmosphere: {
        humidity: 56
      },
      wind: {
        speed: 25,
        direction: 195
      }
    },
    forecasts: [
      { code: 44, high: 86, low: 70 },
      { code: 44, high: 94, low: 73 },
      { code: 4, high: 95, low: 78 },
      { code: 24, high: 75, low: 89 },
      { code: 24, high: 89, low: 77 },
      { code: 44, high: 92, low: 79 },
      { code: 44, high: 89, low: 77 }
    ],
  };
  // TODO uncomment line below to test app with fake data
  // app.updateForecastCard(initialWeatherForecast);

  /************************************************************************
   *
   * Code required to start the app
   *
   * NOTE: To simplify this codelab, we've used localStorage.
   *   localStorage is a synchronous API and has serious performance
   *   implications. It should not be used in production applications!
   *   Instead, check out IDB (https://www.npmjs.com/package/idb) or
   *   SimpleDB (https://gist.github.com/inexorabletash/c8069c042b734519680c)
   ************************************************************************/

  // TODO add startup code here
  app.selectedCities = localStorage.selectedCities;
  if (app.selectedCities) {
    app.selectedCities = JSON.parse(app.selectedCities);
    app.selectedCities.forEach(function (city) {
      app.getForecast(city.key, city.label);
    });
  } else {
    /* The user is using the app for the first time, or the user has not
     * saved any cities, so show the user some fake data. A real app in this
     * scenario could guess the user's location via IP lookup and then inject
     * that data into the page.
     */
    app.updateForecastCard(initialWeatherForecast);
    app.selectedCities = [
      { key: initialWeatherForecast.key, label: initialWeatherForecast.label }
    ];
    app.saveSelectedCities();
    app.getUserLocation();
  }

  // TODO add service worker code here
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./service-worker.js')
      .then(function () { console.log('Service Worker Registered'); });
  }
})();
