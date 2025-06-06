const l = console.log;
const config = require('../settings');
const { cmd } = require('../lib/command');
const axios = require('axios');
const NodeCache = require('node-cache');
const searchCache = new NodeCache({ stdTTL: 60 });

cmd({
  pattern: "sub",
  alias: ["subfilm"],
  react: "🆚",
  desc: "Search and download movies with Sinhala subtitles from CineSubz",
  category: "movie",
  filename: __filename,
}, async (conn, mek, m, { from, q }) => {
  if (!q) {
    await conn.sendMessage(from, {
      text: `🎬 *CineSubz Sinhala Movie Search*\n\n📌 Usage: .sub <movie name>\n📥 Example: .sub Deadpool`,
    }, { quoted: mek });
    return;
  }

  try {
    const cacheKey = `sub_cinesubz_${q.toLowerCase()}`;
    let searchData = searchCache.get(cacheKey);

    if (!searchData) {
      const url = `https://cinesubz-api-zazie.vercel.app/api/search?q=${encodeURIComponent(q)}`;
      const res = await axios.get(url, { timeout: 10000 });
      if (!res.data.status || !res.data.result?.data?.length) throw new Error("No results found.");
      searchData = res.data.result.data;
      searchCache.set(cacheKey, searchData);
    }

    const results = searchData.map((r, i) => ({
      number: i + 1,
      title: r.title || "Unknown",
      year: r.year || "N/A",
      link: r.link,
    }));

    let msg = `*🎬 SEARCH RESULTS*\n\n`;
    for (const r of results) {
      msg += `🎥 ${r.number}. *${r.title}* (${r.year})\n`;
    }
    msg += `\n🔢 Reply with number to choose\n❌ Reply 'done' to cancel`;

    const listMsg = await conn.sendMessage(from, { text: msg }, { quoted: mek });
    const listMsgId = listMsg.key.id;
    const selectionMap = new Map();

    const handleReply = async (update) => {
      const msgObj = update.messages?.[0];
      if (!msgObj?.message?.extendedTextMessage) return;

      const replyText = msgObj.message.extendedTextMessage.text.trim();
      const repliedId = msgObj.message.extendedTextMessage.contextInfo?.stanzaId;

      if (replyText.toLowerCase() === 'done') {
        conn.ev.off("messages.upsert", handleReply);
        await conn.sendMessage(from, { text: `✅ Cancelled.` }, { quoted: msgObj });
        return;
      }

      // First reply: movie selection
      if (repliedId === listMsgId) {
        const index = parseInt(replyText);
        const selected = results.find(r => r.number === index);
        if (!selected) {
          await conn.sendMessage(from, { text: `❌ Invalid number.` }, { quoted: msgObj });
          return;
        }

        const res = await axios.get(`https://cinesubz-api-zazie.vercel.app/api/movie?url=${encodeURIComponent(selected.link)}`);
        const data = res.data?.result?.data;
        if (!data?.dl_links?.length) {
          await conn.sendMessage(from, { text: `❌ No download links found.` }, { quoted: msgObj });
          return;
        }

        const links = data.dl_links.map((l, i) => ({
          number: i + 1,
          quality: l.quality,
          size: l.size,
          url: l.link,
        }));

        let cap = `🎬 *${data.title}*\n\n📥 Available Qualities:\n\n`;
        for (const d of links) cap += `${d.number}. *${d.quality}* (${d.size})\n`;
        cap += `\n🔢 Reply with number\n❌ Reply 'done' to cancel`;

        const qualityMsg = await conn.sendMessage(from, {
          image: { url: data.image },
          caption: cap
        }, { quoted: msgObj });

        selectionMap.set(qualityMsg.key.id, { movie: data.title, image: data.image, links });
      }

      // Second reply: quality selection
      else if (selectionMap.has(repliedId)) {
        const { movie, image, links } = selectionMap.get(repliedId);
        const index = parseInt(replyText);
        const selected = links.find(l => l.number === index);

        if (!selected) {
          await conn.sendMessage(from, { text: `❌ Invalid selection.` }, { quoted: msgObj });
          return;
        }

        try {
          // HEAD request to check if file is available
          await axios.head(selected.url, { timeout: 7000 });

          await conn.sendMessage(from, {
            document: { url: selected.url },
            mimetype: "video/mp4",
            fileName: `${movie} - ${selected.quality}.mp4`,
            caption: `🎬 *${movie}*\n📥 Downloaded successfully from CineSubz!`,
            contextInfo: {
              externalAdReply: {
                title: movie,
                body: '🎬 Sinhala Subtitle Movie',
                mediaType: 1,
                thumbnailUrl: image,
                sourceUrl: selected.url,
                renderLargerThumbnail: true,
              }
            }
          }, { quoted: msgObj });

          await conn.sendMessage(from, { react: { text: "✅", key: msgObj.key } });

        } catch (e) {
          await conn.sendMessage(from, {
            text: `⚠️ Upload failed. Here’s the direct link:\n${selected.url}`
          }, { quoted: msgObj });
          await conn.sendMessage(from, { react: { text: "⚠️", key: msgObj.key } });
        }
      }
    };

    conn.ev.on("messages.upsert", handleReply);

  } catch (err) {
    await conn.sendMessage(from, {
      text: `❌ Error: ${err.message}`
    }, { quoted: mek });
    await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
  }
});
