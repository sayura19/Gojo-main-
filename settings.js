const fs = require('fs');
if (fs.existsSync('config.env')) require('dotenv').config({ path: './config.env' });
function convertToBool(text, fault = 'true') {
    return text === fault ? true : false;
}


module.exports = {
SESSION_ID: process.env.SESSION_ID === undefined ? 'fddRBCgS#Sv3UdBUjJbFl21yX2HgU3XR3T3MOBLs6MqS8U6vqsEM' : process.env.SESSION_ID,
OWNER_NUMBER: process.env.OWNER_NUMBER === undefined ? '94743826406' : process.env.OWNER_NUMBER,  
PREFIX: process.env.PREFIX || '.' ,
POSTGRESQL_URL: process.env.POSTGRESQL_URL === undefined ? 'postgres://vajiratech_user:oSIFl2xmSojMZ0rkzdd0g0W6msuVTpNN@dpg-cpd7fjv109ks73e5gtig-a.frankfurt-postgres.render.com/vajiratech' : process.env.POSTGRESQL_URL,   
ALIVE:  process.env.ALIVE  || '> GOJO MD',
GEMINI_API_KEY:process.env.GEMINI_API_KEY || 'AIzaSyDQIUl78aFtIgsNKY1RUU82nDkL905UbtA',
AUTO_READ_STATUS: process.env.AUTO_READ_STATUS || "true",
MODE: process.env.MODE || "public",
AUTO_VOICE: process.env.AUTO_VOICE || "true",
AUTO_STICKER: process.env.AUTO_STICKER || "true",
AUTO_REPLY: process.env.AUTO_REPLY || "true",
WEATHER_API_KEY: prprocess.env.WEATHER_API_KEY || "482e01ea59b22b270254d3fde0e02798",

};
