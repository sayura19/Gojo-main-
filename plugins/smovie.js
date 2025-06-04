const l = console.log;
const { cmd } = require('../lib/command');
const axios = require('axios');

const replyTrackers = new Map();

function addReplyTracker(id, handler) {
    replyTrackers.set(id, handler);
}

async function handleReply(conn, mek) {
    const msgId = mek.message?.extendedTextMessage?.contextInfo?.stanzaId || mek.key?.id;
    const handler = replyTrackers.get(msgId);
    if (handler) {
        await handler(mek, mek.message?.conversation || mek.message?.extendedTextMessage?.text || '');
        replyTrackers.delete(msgId);
    }
}

cmd({
    pattern: "sub",
    alias: ["subfilm"],
    desc: "🎬 සිංහල උපසිරසි චිත්‍රපට සෙවීම",
    category: "movie",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply("🎬 කරුණාකර චිත්‍රපටියක නමක් සපයන්න! (උදා: Titanic)");

    let res;
    try {
        res = await axios.get(`https://cinesubz-api-zazie.vercel.app/api/search?q=${encodeURIComponent(q)}`);
    } catch {
        return reply("❌ සෙවීමේ දෝෂයක්. නැවත උත්සාහ කරන්න.");
    }

    const data = res.data?.result?.data || [];
    if (data.length === 0) return reply("😔 කිසිදු ප්‍රතිඵලයක් හමු නොවීය.");

    let msg = `🎥 *"${q}" සඳහා හමු වූ චිත්‍රපට:\n\n`;
    data.slice(0, 10).forEach((movie, i) => {
        msg += `*${i + 1}.* ${movie.title} (${movie.year})\n`;
    });
    msg += `\n📩 *ඔබට අවශ්‍ය චිත්‍රපටයේ අංකය Reply කරන්න.*`;

    const sent = await conn.sendMessage(from, { text: msg }, { quoted: mek });

    addReplyTracker(sent.key.id, async (mek2, msg2) => {
        const selected = parseInt(msg2.trim());
        if (isNaN(selected) || selected < 1 || selected > data.length) {
            return reply("❌ වලංගු අංකයක් ලබාදෙන්න.");
        }

        const selectedMovie = data[selected - 1];
        let detail;
        try {
            // FIX: Use movie slug (last part of URL path)
            const movieSlug = selectedMovie.link.split("/").filter(Boolean).pop();
            const url = `https://cinesubz-api-zazie.vercel.app/api/movie/${movieSlug}`;
            detail = await axios.get(url);
        } catch {
            return reply("❌ විස්තර ලබාගැනීමේදී දෝෂයක්.");
        }

        const movie = detail.data.result.data;
        if (!movie.dl_links || movie.dl_links.length === 0) return reply("😔 බාගැනීමේ link නැහැ.");

        let dmsg = `🎬 *${movie.title}*\n📅 *${movie.date}*\n⭐ *IMDB:* ${movie.imdbRate}\n🌍 *රට:* ${movie.country}\n\n*📥 බාගත කිරීමේ විකල්ප:\n\n`;
        movie.dl_links.forEach((dl, i) => {
            dmsg += `*${i + 1}.* ${dl.quality} (${dl.size})\n`;
        });
        dmsg += `\nReply කරන්න අවශ්‍ය Quality එකේ අංකය`;

        const sent2 = await conn.sendMessage(from, { text: dmsg }, { quoted: mek });

        addReplyTracker(sent2.key.id, async (mek3, msg3) => {
            const pick = parseInt(msg3.trim());
            if (isNaN(pick) || pick < 1 || pick > movie.dl_links.length) {
                return reply("❌ වලංගු අංකයක් ලබාදෙන්න.");
            }

            const selectedLink = movie.dl_links[pick - 1];

            await conn.sendMessage(from, {
                document: { url: selectedLink.link },
                mimetype: "video/mp4",
                fileName: `${movie.title} - ${selectedLink.quality}.mp4`,
                caption: `🎬 *${movie.title}*\n📥 ${selectedLink.quality} - ${selectedLink.size}\n\nPowered by SOLO-LEVELING`,
            }, { quoted: mek });
        });
    });
});

module.exports.handleReply = handleReply;
