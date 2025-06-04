const config = require('../settings')
const { cmd, commands } = require('../lib/command')
const { getBuffer, fetchJson } = require('../lib/functions')
const { sizeFormatter } = require('human-readable')
const GDriveDl = require('../lib/gdrive.js'); // ✅ CORRECT
const N_FOUND = "*I couldn't find anything :(*"

cmd({
  pattern: 'ck',
  react: '🎬',
  desc: 'සිංහල උපසිරැසි සහිත චිත්‍රපට සෙවීම (CineSubs)',
  category: 'movie',
  filename: __filename
}, async (conn, m, mek, { from, q, prefix, reply }) => {
  if (!q) return reply('📌 කරුණාකර චිත්‍රපටියේ නමක් සපයන්න. උදා: `.ck Deadpool`')

  try {
    const res = await fetchJson(`https://vajira-movie-api.vercel.app/api/cinesubs/search?q=${encodeURIComponent(q)}&apikey=vajiraofficial`)
    const results = res?.data?.data?.data

    if (!results || !results.length) return reply(`❌ *"${q}"* සඳහා කිසිවක් සොයාගෙන නැහැ.`)

    let list = results.map((x, i) => ({
      title: `${i + 1}`,
      description: x.title,
      rowId: `${prefix}ckdl ${x.link}|${x.title}`
    }))

    const sections = [{ title: "📽️ *CineSubs Results*", rows: list }]

    const listMessage = {
      text: '',
      footer: config.FOOTER,
      title: '📥 ඔබට අවශ්‍ය චිත්‍රපටිය තෝරන්න',
      buttonText: '🔢 තෝරන්න',
      sections
    }

    return await conn.replyList(from, listMessage, { quoted: mek })
  } catch (e) {
    console.error(e)
    return reply('⚠️ දෝෂයක් ඇතිවුණා. පසුව උත්සහ කරන්න.')
  }
})

cmd({
  pattern: 'ckdl',
  dontAddCommandList: true,
  filename: __filename
}, async (conn, mek, m, { q, reply, from }) => {
  if (!q) return reply('❌ Movie URL එකක් හෝ තොරතුරක් නොමැත.')

  try {
    const [url, title] = q.split('|')

    const res = await fetchJson(`https://vajira-movie-api.vercel.app/api/cinesubs/movie?url=${url}&apikey=vajiraofficial`)
    const movie = res?.data?.data?.moviedata

    if (!movie?.download?.url) return reply('❌ මෙම චිත්‍රපටයට download link එකක් සොයාගත නොහැක.')

    await reply('⬇️ චිත්‍රපටිය download කරමින් පවතියි. කරුණාකර මොහොතක් රැඳෙන්න...')

    const msg = {
      document: await getBuffer(movie.download.url),
      fileName: `${movie.title}.mp4`,
      mimetype: "video/mp4",
      caption: `🎬 *${movie.title}*\n\n🗓️ දිනය: ${movie.date}\n🌍 රට: ${movie.country || "N/A"}\n\n© CineSubs | GOJO MD`,
    }

    await conn.sendMessage(from, msg, { quoted: mek })

    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } })
  } catch (e) {
    console.error(e)
    return reply('⚠️ Movie එක ලබාගැනීමේදී දෝෂයක් සිදුවී ඇත.')
  }
})
