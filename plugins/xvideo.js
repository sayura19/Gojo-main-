const l = console.log
const config = require('../settings')
const { cmd, commands } = require('../lib/command')
import { xvideosSearch, xvideosdl } from '../lib/ascraper.js'

const cmd = require('../lib/command').cmd

cmd(
  {
    pattern: "xvid",
    alias: ["xvideos"],
    react: "🔞",
    desc: "Search and download Xvideos videos",
    category: "nsfw",
    filename: __filename,
    group: true,
    premium: false,
    register: true,
  },
  async (robin, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, reply }) => {
    try {
      if (!q) return reply(`✳️ What do you want to search?\n\nUsage: *${command} <search or URL>*\nExample: Hot desi bhabi or Xvideos URL`);

      // Check NSFW and age
      let chat = global.db.data.chats[m.chat]
      if (!chat.nsfw) return reply(`🚫 This group does not support NSFW content.\nTo turn it on, use: *${command} enable nsfw*`);
      let userAge = global.db.data.users[m.sender].age || 0
      if (userAge < 18) return reply(`❎ You must be 18 years or older to use this feature.`);

      m.react('⌛')

      const isURL = /^(https?:\/\/)?(www\.)?xvideos\.com\/.+$/i.test(q);

      if (isURL) {
        const videoLinks = await xvideosdl(q)
        const videoUrl = videoLinks.high || videoLinks.low || videoLinks.hls

        if (!videoUrl) return reply("❌ Video URL not found.")

        // send the video directly
        await robin.sendMessage(from, {
          video: { url: videoUrl },
          caption: "🔞 Here is your Xvideos video."
        }, { quoted: mek })

      } else {
        const results = await xvideosSearch(q)
        if (!results.length) return reply("No search results found for the given query.")

        const searchResults = results.map((res, i) => `${i+1}. *${res.title}*\nDuration: ${res.duration}\nURL: ${res.videoUrl}`).join('\n\n')

        reply(`*Search Results for "${q}":*\n\n${searchResults}`)
      }

    } catch (e) {
      console.error(e)
      reply(`❌ Error: ${e.message || e}`)
    }
  }
)