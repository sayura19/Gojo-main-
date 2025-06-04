const { cmd } = require('../lib/command');
const { fetchJson, getBuffer } = require('../lib/functions');
const config = require('../settings');

cmd({
  pattern: "ck",
  alias: ["cine"],
  react: "🎬",
  desc: "CineSubs චිත්‍රපට සෙවීම",
  category: "movie",
  filename: __filename,
}, async (conn, m, mek, { q, from, reply }) => {
  if (!q) return reply("*🎬 කරුණාකර චිත්‍රපට නමක් ලබා දෙන්න.*");

  try {
    const data = await fetchJson(`https://vajira-movie-api.vercel.app/api/cinesubs/search?q=${encodeURIComponent(q)}&apikey=vajiraofficial`);
    const results = data?.data?.data;

    if (!results?.length) return reply(`❌ *"${q}" සඳහා කිසිඳු ප්‍රතිඵලයක් හමු නොවුණි.*`);

    let msg = `🎬 *"${q}" සඳහා හමු වූ චිත්‍රපට:* \n\n`;
    results.slice(0, 10).forEach((movie, i) => {
      msg += `*${i + 1}.* ${movie.title} (${movie.year})\n${movie.link}\n\n`;
    });
    msg += "📥 *කරුණාකර ඉදිරියට යාමට අංකය reply කරන්න.*";

    const sent = await conn.sendMessage(from, { text: msg }, { quoted: mek });
    const replyID = sent.key.id;

    conn.addReplyTracker(replyID, async (mek, res) => {
      const index = parseInt(res.trim());
      if (isNaN(index) || index < 1 || index > results.length) return reply("❌ වැරදි අංකයකි. නැවත උත්සාහ කරන්න.");

      const selected = results[index - 1];

      const info = await fetchJson(`https://vajira-movie-api.vercel.app/api/cinesubs/movie?url=${selected.link}&apikey=vajiraofficial`);
      const movie = info?.data?.data;

      if (!movie || !movie.download || !movie.download.link) return reply("❌ බාගත කිරීමේ ලින්ක් නොමැත.");

      await reply("📥 *ඔබේ චිත්‍රපටය බාගත කරමින් පවතී...*");

      await conn.sendMessage(from, {
        document: await getBuffer(movie.download.link),
        fileName: `${movie.title}.mp4`,
        mimetype: "video/mp4",
        caption: `🎬 *${movie.title}*\n📅 *දිනය:* ${movie.date || "නොමැත"}\n🌐 *CineSubs චිත්‍රපටයක්*\n\n© 2025 GOJO MD`,
      }, { quoted: mek });

      await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    });

  } catch (e) {
    console.error("CineSubs Error:", e.message);
    reply("❌ *දෝෂයක් සිදු විය. පසුව නැවත උත්සාහ කරන්න.*");
  }
});
