const { cmd } = require('../lib/command');
const axios = require('axios');

function getCurrentDateTime() {
    const now = new Date();
    const offset = 5.5 * 60 * 60 * 1000;
    const localTime = new Date(now.getTime() + offset);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const day = days[localTime.getUTCDay()];
    const date = localTime.toISOString().split('T')[0];
    const time = localTime.toISOString().split('T')[1].split('.')[0];
    return `${day}, ${date}, ${time} +0530`;
}

async function searchMovies(query) {
    try {
        const res = await axios.get(`https://cinesubz-api-zazie.vercel.app/api/search?q=${encodeURIComponent(query)}`);
        return res.data.result.data || [];
    } catch (err) {
        return [];
    }
}

async function getMovieDetails(movieUrl) {
    const apiUrl = `https://cinesubz-api-zazie.vercel.app/api/movie?url=${encodeURIComponent(movieUrl)}`;
    const response = await axios.get(apiUrl);
    const movieData = response.data.result.data;
    if (!movieData || !movieData.dl_links?.length) throw new Error("No links");

    return {
        title: movieData.title,
        image: movieData.image,
        imdb: movieData.imdbRate,
        date: movieData.date,
        country: movieData.country,
        runtime: movieData.duration,
        dl_links: movieData.dl_links,
    };
}

let activeSessions = new Map(); // in-memory store

cmd({
    pattern: "sub",
    desc: "Search and download movies",
    category: "movie",
    filename: __filename,
},
async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply("🎬 Please type a movie name!");

    const movies = await searchMovies(q);
    if (movies.length === 0) return reply("❌ No results found.");

    let txt = `🎬 *Search Results for:* "${q}"\n\n`;
    movies.slice(0, 5).forEach((movie, i) => {
        txt += `*${i + 1}.* ${movie.title} (${movie.year})\n🔗 ${movie.link}\n\n`;
    });
    txt += "💬 *Reply with a number (1-5) to select a movie.*";

    await conn.sendMessage(from, { text: txt }, { quoted: mek });
    activeSessions.set(from, { step: "select_movie", movies, user: mek.key.participant || from });
});

// Reply handler (should be registered globally in your bot)
async function handleReply(conn, mek) {
    const from = mek.key.remoteJid;
    const session = activeSessions.get(from);
    if (!session || mek.key.participant !== session.user) return;

    const body = mek.message?.conversation || "";
    const num = parseInt(body.trim());

    if (session.step === "select_movie") {
        const movie = session.movies[num - 1];
        if (!movie) return conn.sendMessage(from, { text: "Invalid choice." });

        const details = await getMovieDetails(movie.link);
        let cap = `🎬 *${details.title}*\n⭐ IMDB: ${details.imdb}\n📅 ${details.date}\n🌍 ${details.country}\n🕒 ${details.runtime}\n\n`;
        details.dl_links.forEach((l, i) => {
            cap += `*${i + 1}.* ${l.quality} - ${l.size}\n🔗 ${l.link}\n\n`;
        });
        cap += "💬 *Reply with number to get download link.*";

        await conn.sendMessage(from, { text: cap }, { quoted: mek });
        activeSessions.set(from, { step: "select_quality", links: details.dl_links, user: mek.key.participant || from });
    } else if (session.step === "select_quality") {
        const link = session.links[num - 1];
        if (!link) return conn.sendMessage(from, { text: "Invalid selection." });

        await conn.sendMessage(from, {
            document: { url: link.link },
            fileName: `${link.quality}.mp4`,
            mimetype: "video/mp4",
            caption: `⬇️ Downloading: ${link.quality} - ${link.size}`,
        }, { quoted: mek });

        activeSessions.delete(from);
    }
}
module.exports.handleReply = handleReply;
