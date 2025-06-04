const { cmd } = require('../lib/command');
const { getBuffer } = require('../lib/functions');
const puppeteer = require('puppeteer');

const BASE_URL = 'https://www.cinesubz.co';

cmd({
  pattern: 'cinesubs',
  alias: ['cs'],
  desc: 'CineSubs Sinhala movie downloader',
  category: 'movie',
  react: '🎬',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  if (!q) return reply('🎬 *කරුණාකර චිත්‍රපටියෙ නමක් දෙන්න* (eg: `cinesubs Deadpool`)');

  await reply('🔍 චිත්‍රපටිය සොයමින්... කරුණාකර රැඳී සිටින්න...');

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/?s=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded' });

    const results = await page.evaluate(() => {
      const movies = [];
      document.querySelectorAll('.ml-item').forEach(el => {
        const title = el.querySelector('.mli-info h2')?.innerText.trim();
        const link = el.querySelector('a')?.href;
        if (title && link) {
          movies.push({ title, link });
        }
      });
      return movies;
    });

    if (!results.length) {
      await browser.close();
      return reply(`❌ "*${q}*" සඳහා කිසිවක් හමු නොවුණි.`);
    }

    const topMovie = results[0];
    await page.goto(topMovie.link, { waitUntil: 'domcontentloaded' });

    const downloadLink = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('a')]
        .find(a => a.href.includes('.mp4') || a.innerText.toLowerCase().includes('download'));
      return btn?.href || null;
    });

    const image = await page.evaluate(() =>
      document.querySelector('.mimg img')?.src || ''
    );

    await browser.close();

    if (!downloadLink) return reply('❌ Download link එක සොයාගත නොහැකි විය.');

    const caption = `🎬 *${topMovie.title}*\n\n📥 Downloading now...`;

    await conn.sendMessage(from, {
      document: await getBuffer(downloadLink),
      mimetype: 'video/mp4',
      fileName: `${topMovie.title}.mp4`,
      caption,
      contextInfo: {
        externalAdReply: {
          title: topMovie.title,
          body: 'CineSubs Sinhala Movie',
          mediaType: 1,
          sourceUrl: topMovie.link,
          thumbnailUrl: image,
          renderLargerThumbnail: true,
        }
      }
    }, { quoted: mek });

  } catch (e) {
    console.error('CineSubs error:', e);
    reply('❌ දෝෂයක් ඇතිවීය. නැවත උත්සාහ කරන්න.');
  }
});
