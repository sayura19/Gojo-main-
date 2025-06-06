const l = console.log;
const config = require('../settings');
const { cmd } = require('../lib/command');
const axios = require('axios');
const NodeCache = require('node-cache');

const searchCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

cmd({
  pattern: "sub",
  react: "🛸",
  desc: "Search Sinhala Movies with subtitles",
  category: "media",
  filename: __filename,
}, async (conn, mek, m, { from, q }) => {
  if (!q) {
    await conn.sendMessage(from, {
      text: `🎬 *CineSubz Sinhala Movie Downloader*\n\n📌 *Usage:* .sub <movie name>\n💡 Example: .sub Krrish`
    }, { quoted: mek });
    return;
  }

  try {
    const cacheKey = `sub_search_${q.toLowerCase()}`;
    let searchData = searchCache.get(cacheKey);

    if (!searchData) {
      const searchUrl = `https://cinesubz-api-zazie.vercel.app/api/search?q=${encodeURIComponent(q)}`;
      let retries = 3;
      while (retries > 0) {
        try {
          const response = await axios.get(searchUrl, { timeout: 10000 });
          searchData = response.data;
          break;
        } catch (err) {
          retries--;
          if (retries === 0) {
            throw new Error("❌ Failed to reach CineSubz API. Try again later.");
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!searchData || !searchData.status || !Array.isArray(searchData.results) || searchData.results.length === 0) {
        await conn.sendMessage(from, {
          text: `❌ No results found for: "${q}"\n🔁 Try a different movie or TV title.`
        }, { quoted: mek });
        return;
      }

      searchCache.set(cacheKey, searchData);
    }

    const results = searchData.results.slice(0, 10).map((film, index) => ({
      number: index + 1,
      title: film.title,
      year: film.year,
      imdb: film.imdb,
      image: film.image,
      link: film.link
    }));

    let textList = `*🎬 SEARCH RESULTS*\n\n`;
    for (const movie of results) {
      textList += `🎥 ${movie.number}. *${movie.title}* (${movie.year})\n⭐ IMDB: ${movie.imdb}\n\n`;
    }
    textList += `🔢 Reply with number to select\n❌ Reply 'done' to cancel`;

    const listMsg = await conn.sendMessage(from, {
      image: { url: results[0].image },
      caption: textList
    }, { quoted: mek });

    const listMsgId = listMsg.key.id;
    const selectionMap = new Map();

    const selectionHandler = async (update) => {
      const msg = update.messages?.[0];
      if (!msg?.message?.extendedTextMessage) return;

      const reply = msg.message.extendedTextMessage.text.trim();
      const repliedId = msg.message.extendedTextMessage.contextInfo?.stanzaId;

      if (reply.toLowerCase() === "done") {
        conn.ev.off("messages.upsert", selectionHandler);
        selectionMap.clear();
        await conn.sendMessage(from, { text: `✅ Stopped. You can start again using *.sub <name>*` }, { quoted: msg });
        return;
      }

      // First reply to list
      if (repliedId === listMsgId) {
        const selected = results.find(r => r.number === parseInt(reply));
        if (!selected) {
          await conn.sendMessage(from, { text: `❌ Invalid number.` }, { quoted: msg });
          return;
        }

        const detailUrl = `https://cinesubz-api-zazie.vercel.app/api/movie?url=${encodeURIComponent(selected.link)}`;
        let movieData;
        let retries = 3;
        while (retries > 0) {
          try {
            const res = await axios.get(detailUrl, { timeout: 10000 });
            movieData = res.data;
            break;
          } catch (err) {
            retries--;
            if (retries === 0) {
              await conn.sendMessage(from, {
                text: `❌ Failed to fetch movie details.\nTry again later.`
              }, { quoted: msg });
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (!movieData?.status || !movieData?.movie?.download_links) {
          await conn.sendMessage(from, { text: `❌ No valid download links.` }, { quoted: msg });
          return;
        }

        const links = movieData.movie.download_links;
        const downloadOptions = [];

        const sd = links.find(l => l.quality.includes("480p") && l.direct_download);
        if (sd) downloadOptions.push({ number: 1, quality: "SD", size: sd.size, url: sd.direct_download });

        let hd = links.find(l => l.quality.includes("720p") && l.direct_download);
        if (!hd) hd = links.find(l => l.quality.includes("1080p") && l.direct_download);
        if (hd) downloadOptions.push({ number: 2, quality: "HD", size: hd.size, url: hd.direct_download });

        if (downloadOptions.length === 0) {
          await conn.sendMessage(from, { text: `❌ No downloadable links found.` }, { quoted: msg });
          return;
        }

        let caption = `🎬 *${selected.title}*\n\n📥 Choose Quality:\n`;
        for (const opt of downloadOptions) {
          caption += `${opt.number}. *${opt.quality}* (${opt.size})\n`;
        }
        caption += `\n🔢 Reply with number\n❌ Reply 'done' to stop`;

        const qualityMsg = await conn.sendMessage(from, {
          image: { url: movieData.movie.thumbnail || selected.image },
          caption
        }, { quoted: msg });

        selectionMap.set(qualityMsg.key.id, { film: selected, options: downloadOptions });
      }

      // Second reply to quality selection
      else if (selectionMap.has(repliedId)) {
        const { film, options } = selectionMap.get(repliedId);
        const selected = options.find(o => o.number === parseInt(reply));

        if (!selected) {
          await conn.sendMessage(from, { text: `❌ Invalid selection.` }, { quoted: msg });
          return;
        }

        const size = selected.size.toLowerCase();
        let sizeInGB = 0;
        if (size.includes("gb")) sizeInGB = parseFloat(size.replace("gb", ""));
        else if (size.includes("mb")) sizeInGB = parseFloat(size.replace("mb", "")) / 1024;

        if (sizeInGB > 2) {
          await conn.sendMessage(from, {
            text: `⚠️ File too large to send.\n\n🔗 *Direct Link:*\n${selected.url}`
          }, { quoted: msg });
          return;
        }

        try {
          await conn.sendMessage(from, {
            document: { url: selected.url },
            mimetype: "video/mp4",
            fileName: `${film.title} - ${selected.quality}.mp4`,
            caption: `✅ Download complete!\n🎬 ${film.title}\n📊 Size: ${selected.size}`
          }, { quoted: msg });
          await conn.sendMessage(from, { react: { text: "✅", key: msg.key } });
        } catch (err) {
          await conn.sendMessage(from, {
            text: `❌ Upload failed. Use direct link:\n${selected.url}`
          }, { quoted: msg });
        }
      }
    };

    conn.ev.on("messages.upsert", selectionHandler);

  } catch (e) {
    console.error("Sub Command Error:", e);
    await conn.sendMessage(from, { text: `❌ Error: ${e.message || "Unknown error"}` }, { quoted: mek });
    await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
  }
});
