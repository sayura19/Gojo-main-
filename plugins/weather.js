const axios = require('axios');
const { cmd, tlang } = require('../lib');
const { WEATHER_API_KEY } = require('../settings'); // <-- API key එක import කරන්නෙ මෙතැනින්

cmd({
    pattern: "weather",
    category: "search",
    react: "🛸",
    desc: "Sends weather info about asked place.",
    use: "<location>",
    filename: __filename,
},
async (Void, citel, text) => {
    if (!text) return citel.reply(`_Give me a location ${tlang().greet}_`);

    try {
        const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(text)}&units=metric&appid=${WEATHER_API_KEY}&lang=en`);

        const data = res.data;
        const weather = data.weather[0];

        let message = `*🌤️ Weather Report for ${data.name}, ${data.sys.country}*\n\n`;
        message += `*Condition:* ${weather.main} - ${weather.description}\n`;
        message += `*Temperature:* ${data.main.temp}°C\n`;
        message += `*Feels Like:* ${data.main.feels_like}°C\n`;
        message += `*Humidity:* ${data.main.humidity}%\n`;
        message += `*Pressure:* ${data.main.pressure} hPa\n`;
        message += `*Wind Speed:* ${data.wind.speed} m/s\n`;
        message += `*Coordinates:* [${data.coord.lat}, ${data.coord.lon}]\n`;

        return citel.reply(message);

    } catch (err) {
        console.error(err);
        if (err.response?.data?.message) {
            return citel.reply(`❌ Error: ${err.response.data.message}`);
        }
        citel.reply("⚠️ Couldn't fetch weather info. Please try again later.");
    }
});