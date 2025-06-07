const axios = require('axios');
const { cmd, tlang } = require('../lib/command');
const { WEATHER_API_KEY } = require('../settings');

cmd({
    pattern: "weather",
    category: "search",
    react: "⛅",
    desc: "Shows weather information of a city",
    use: "<city>",
    filename: __filename
},
async (Void, citel, text) => {
    if (!text) return citel.reply("📍 Please provide a city name.\nExample: `.weather Colombo`");

    const city = text.trim();
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}&lang=en`;

    try {
        const response = await axios.get(url);
        const data = response.data;
        const weather = data.weather[0];

        let msg = `🌦️ *Weather in ${data.name}, ${data.sys.country}*\n\n`;
        msg += `🌡️ Temp: ${data.main.temp}°C (feels like ${data.main.feels_like}°C)\n`;
        msg += `💧 Humidity: ${data.main.humidity}%\n`;
        msg += `💨 Wind: ${data.wind.speed} m/s\n`;
        msg += `🔎 Condition: ${weather.main} - ${weather.description}\n`;
        msg += `📍 Coordinates: ${data.coord.lat}, ${data.coord.lon}`;

        return citel.reply(msg);

    } catch (error) {
        if (error.response?.data?.cod === '404') {
            return citel.reply(`❌ City not found. Please check the spelling.`);
        }

        console.error("Weather API Error:", error.response?.data || error);
        return citel.reply("⚠️ Couldn't fetch weather info. Try again later.");
    }
});
