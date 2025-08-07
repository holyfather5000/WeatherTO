let currentCity = localStorage.getItem('city') || 'Toronto';

function formatTimeShort(unixTime) {
  const date = new Date(unixTime * 1000);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true
  }).replace(':00', '');
}

function getCurrentTime() {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  const match = timeString.match(/^(\d{1,2}:\d{2})\s*([AP]M)$/);
  if (match) {
    return `${match[1]}<span id="ampm">${match[2]}</span>`;
  }
  return timeString;
}

async function getWeatherAndAirQuality() {
  const apiKey = 'e5b6fb3f049377a3fb4da24d6d858698';
  const city = currentCity;
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${apiKey}`;

  try {
    // --- CURRENT WEATHER ---
    const response = await fetch(weatherUrl);
    if (!response.ok) throw new Error("Weather data not found");
    const data = await response.json();

    const { temp, feels_like, humidity } = data.main;
    const description = data.weather[0].description;
    const icon = data.weather[0].icon;
    const windSpeed = Math.round(data.wind.speed);
    const sunrise = new Date(data.sys.sunrise * 1000).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });
    const sunset = new Date(data.sys.sunset * 1000).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });
    const lat = data.coord.lat;
    const lon = data.coord.lon;

    document.getElementById('city').textContent = city;
    document.getElementById('current-time').innerHTML = getCurrentTime();
    document.getElementById('icon').src = `https://openweathermap.org/img/wn/${icon}@2x.png`;
    document.getElementById('temp').textContent = Math.round(temp);
    document.getElementById('feels').textContent = Math.round(feels_like);
    document.getElementById('desc').textContent = description;
    document.getElementById('humidity').textContent = humidity;
    document.getElementById('wind').textContent = windSpeed;
    document.getElementById('sunrise').textContent = sunrise;
    document.getElementById('sunset').textContent = sunset;

    // --- AQI ---
    const aqiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const aqiResponse = await fetch(aqiUrl);
    if (!aqiResponse.ok) throw new Error("Air quality data not found");
    const aqiData = await aqiResponse.json();
    const aqi = aqiData.list[0].main.aqi;

    const aqiDescriptions = { 1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor" };
    const aqiElement = document.getElementById('aqi');
    aqiElement.textContent = `${aqi} (${aqiDescriptions[aqi]})`;
    aqiElement.className = '';
    switch (aqi) {
      case 1: aqiElement.classList.add('aqi-good'); break;
      case 2: aqiElement.classList.add('aqi-fair'); break;
      case 3: aqiElement.classList.add('aqi-moderate'); break;
      case 4: aqiElement.classList.add('aqi-poor'); break;
      case 5: aqiElement.classList.add('aqi-very-poor'); break;
    }

    // --- FORECAST ---
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    const forecastRes = await fetch(forecastUrl);
    if (!forecastRes.ok) throw new Error("Forecast data not found");
    const forecastData = await forecastRes.json();
    const forecastList = forecastData.list;

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Group by date
    const byDate = {};
    forecastList.forEach(item => {
      const date = item.dt_txt.split(" ")[0];
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(item.main.temp);
    });

    // --- Next 24h forecast ---
    const nowUnix = Math.floor(Date.now() / 1000);
    const next24hForecast = forecastList.filter(item =>
      item.dt > nowUnix && item.dt <= nowUnix + 86400
    ).map(item => ({
      time: formatTimeShort(item.dt),
      temp: Math.round(item.main.temp),
      icon: item.weather[0].icon
    }));

    const forecastContainer = document.getElementById('tomorrow-forecast');
    if (forecastContainer) {
      forecastContainer.innerHTML = next24hForecast.map(f => `
        <div class="forecast-hour">
          <div class="forecast-time">${f.time}</div>
          <img src="https://openweathermap.org/img/wn/${f.icon}.png" alt="">
          <div class="forecast-temp">${f.temp}°C</div>
        </div>
      `).join('');
    }

    // --- 3-Day forecast ---
    const days = Object.keys(byDate).filter(date => date > today).sort().slice(0, 3);
    const threeDayForecast = days.map(date => {
      const temps = byDate[date];
      const avgTemp = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
      const icons = forecastList.filter(item => item.dt_txt.startsWith(date)).map(item => item.weather[0].icon);
      const icon = icons.sort((a,b) =>
        icons.filter(v => v === a).length - icons.filter(v => v === b).length
      ).pop();
      return { date, avgTemp, icon };
    });

    const threeDayContainer = document.getElementById('three-day-forecast');
    if (threeDayContainer) {
      threeDayContainer.innerHTML = `
        <h3>3-Day Forecast</h3>
        <div style="display:flex;gap:16px;">
          ${threeDayForecast.map(day => `
            <div class="forecast-hour">
              <div>${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '')}</div>
              <img src="https://openweathermap.org/img/wn/${day.icon}.png" alt="">
              <div class="forecast-temp">${day.avgTemp}°C</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // --- Temp alert ---
    const todayTemps = byDate[today] || [];
    const yesterdayTemps = byDate[yesterdayStr] || [];
    const todayHigh = todayTemps.length ? Math.max(...todayTemps) : null;
    const todayLow = todayTemps.length ? Math.min(...todayTemps) : null;
    const yesterdayHigh = yesterdayTemps.length ? Math.max(...yesterdayTemps) : null;
    const yesterdayLow = yesterdayTemps.length ? Math.min(...yesterdayTemps) : null;

    let alertMsg = '';
    if (todayHigh !== null && yesterdayHigh !== null && Math.abs(todayHigh - yesterdayHigh) >= 3) {
      alertMsg = `⚠ High changed by ${(todayHigh - yesterdayHigh).toFixed(1)}°C from yesterday.`;
    } else if (todayLow !== null && yesterdayLow !== null && Math.abs(todayLow - yesterdayLow) >= 3) {
      alertMsg = `⚠ Low changed by ${(todayLow - yesterdayLow).toFixed(1)}°C from yesterday.`;
    }

    const alertElement = document.getElementById('temp-alert');
    if (alertElement) {
      alertElement.textContent = alertMsg;
      alertElement.style.display = alertMsg ? 'block' : 'none';
    }

  } catch (error) {
    document.getElementById('weather').innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
  }
}



// Service Worker registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/WeatherTO/service-worker.js')
    .then(() => console.log('Service Worker Registered'));
}

window.onload = function () {
  getWeatherAndAirQuality();
  setupCityChangeHandler();
};

// Refresh every 10 minutes
setInterval(() => window.location.reload(), 600000);

// City change handler setup
function setupCityChangeHandler() {
  const citySpan = document.getElementById('city');
  const input = document.createElement('input');
  const error = document.createElement('span');

  input.type = 'text';
  input.id = 'cityInput';
  input.style.display = 'none';
  input.style.marginLeft = '8px';

  error.id = 'cityError';
  error.style.color = 'red';
  error.style.display = 'none';
  error.style.marginLeft = '8px';

  citySpan.parentNode.insertBefore(input, citySpan.nextSibling);
  input.parentNode.insertBefore(error, input.nextSibling);

  citySpan.style.cursor = 'pointer';
  citySpan.title = 'Click to change city';

citySpan.addEventListener('click', () => {
  input.value = currentCity;
  citySpan.style.display = 'none';
  input.style.display = 'inline';

  // Delay focus slightly to ensure keyboard appears on mobile
  setTimeout(() => {
    input.focus();
  }, 50);
});


  input.addEventListener('blur', () => {
    handleCityChange(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.style.display = 'none';
      citySpan.style.display = 'inline';
      error.style.display = 'none';
    }
  });

  async function handleCityChange(newCity) {
    const trimmed = newCity.trim();
    if (!trimmed || trimmed.toLowerCase() === currentCity.toLowerCase()) {
      resetInput();
      return;
    }

    const isValid = await validateCity(trimmed);
    if (isValid) {
      currentCity = trimmed;
      localStorage.setItem('city', currentCity);
      citySpan.textContent = currentCity;
      getWeatherAndAirQuality();
      resetInput();
    } else {
      error.textContent = 'City not found. Try again.';
      error.style.display = 'inline';
    }
  }

  function resetInput() {
    input.style.display = 'none';
    citySpan.style.display = 'inline';
    error.style.display = 'none';
  }

  async function validateCity(cityName) {
    const apiKey = 'e5b6fb3f049377a3fb4da24d6d858698';
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&appid=${apiKey}`;
    try {
      const res = await fetch(url);
      return res.ok;
    } catch {
      return false;
    }
  }
}
