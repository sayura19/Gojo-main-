const { cmd } = require('../lib/command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Timezone +0530 date time
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

// CineSubz API search
async function searchMovies(query) {
    const api = {
        url: `https://cinesubz-api-zazie.vercel.app/api/search?q=${encodeURIComponent(query)}`,
        name: "CineSubz",
        parseResults: (data) => {
            if (!data || !data.status || !data.result || !data.result.data || !Array.isArray(data.result.data)) {
                throw new Error("Invalid response structure");
            }
            return data.result.data.map(item => ({
                title: item.title || "Unknown Title",
                link: item.link || "",
                year: item.year || "N/A",
            }));
        },
    };

    let results = [];
    let errorMessages = [];

    try {
        const response = await axios.get(api.url, { timeout: 10000 });
        results = api.parseResults(response.data);
        if (results.length === 0) {
            errorMessages.push(`${api.name}: No results found`);
        }
    } catch (err) {
        errorMessages.push(`${api.name}: ${err.message}`);
    }

    return { results: results.slice(0, 10), errors: errorMessages };
}

// Fetch movie details incl. download links
async function getMovieDetails(movieUrl) {
    const apiUrl = `https://cinesubz-api-zazie.vercel.app/api/movie?url=${encodeURIComponent(movieUrl)}`;
    try {
        const response = await axios.get(apiUrl, { timeout: 10000 });
        const movieData = response.data.result.data;
        if (!movieData) {
            throw new Error("No movie data returned");
        }
        if (!movieData.dl_links || movieData.dl_links.length === 0) {
            throw new Error("No download links found");
        }
        return {
            title: movieData.title || "Unknown Title",
            imdb: movieData.imdbRate || "N/A",
            date: movieData.date || "N/A",
            country: movieData.country || "N/A",
            runtime: movieData.duration || "N/A",
            image: movieData.image || "",
            dl_links: movieData.dl_links.map(link => ({
                quality: link.quality || "Unknown Quality",
                size: link.size || "Unknown Size",
                link: link.link || "",
            })),
        };
    } catch (err) {
        throw new Error(`Failed to fetch movie details: ${err.message}`);
    }
}

// Download file from URL temporarily
async function downloadFile(url, filename) {
    const writer = fs.createWriteStream(filename);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 60000, // 60 seconds timeout
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

cmd({
    pattern: "sub",
    alias: ["subfilm"],
    react: "🎬",
    desc: "Search and download movies from CineSubz",
    category: "movie",
    filename: __filename,
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return await reply("*Please provide a movie name to search! (e.g., Deadpool)*");
        }

        // Step 1: Search movies
        const { results, errors } = await searchMovies(q);
        if (results.length === 0) {
            return await reply(`*No movies found for:* "${q}"\n${errors.join('\n')}\n*Please try a different search term.*`);
        }

        // Step 2: Send search results
        let resultsMessage = `✨ *SOLO-LEVELING MOVIE DOWNLOADER* ✨\n\n🎥 *Search Results for* "${q}" (Date: ${getCurrentDateTime()}):\n\n`;
        results.forEach((result, index) => {
            resultsMessage += `*${index + 1}.* ${result.title} (${result.year}) [CineSubz]\n\n`;
        });
        resultsMessage += `\n📩 *Please reply with the number of the movie you want to download.*`;

        const sentMsg = await conn.sendMessage(from, { text: resultsMessage }, { quoted: mek });
        const messageID = sentMsg.key.id;

        // Step 3: Wait for movie selection reply
        conn.addReplyTracker(messageID, async (replyMsg) => {
            if (!replyMsg.message) return;
            const from = replyMsg.key.remoteJid;
            const selectedNumber = parseInt(replyMsg.message.conversation || replyMsg.message.extendedTextMessage?.text);
            if (!isNaN(selectedNumber) && selectedNumber > 0 && selectedNumber <= results.length) {
                const selectedMovie = results[selectedNumber - 1];

                // Step 4: Fetch movie details
                let movieData;
                try {
                    movieData = await getMovieDetails(selectedMovie.link);
                } catch (err) {
                    return await reply(`*Error fetching movie details:* ${err.message}\n*Try another movie or check the URL.*`);
                }

                // Step 5: Send download quality options
                let downloadMessage = `🎥 *${movieData.title}*\n\n*Available Download Qualities:*\n`;
                movieData.dl_links.forEach((link, index) => {
                    downloadMessage += `*${index + 1}.* ${link.quality} - ${link.size}\n\n`;
                });
                downloadMessage += `\n📩 *Reply with the number of the quality you want to download.*`;

                const sentDownloadMsg = await conn.sendMessage(from, { text: downloadMessage }, { quoted: replyMsg });
                const downloadMessageID = sentDownloadMsg.key.id;

                // Step 6: Wait for quality selection reply
                conn.addReplyTracker(downloadMessageID, async (qualityReplyMsg) => {
                    if (!qualityReplyMsg.message) return;
                    const from = qualityReplyMsg.key.remoteJid;
                    const selectedQuality = parseInt(qualityReplyMsg.message.conversation || qualityReplyMsg.message.extendedTextMessage?.text);

                    if (!isNaN(selectedQuality) && selectedQuality > 0 && selectedQuality <= movieData.dl_links.length) {
                        const selectedLink = movieData.dl_links[selectedQuality - 1];

                        // Step 7: Download the file
                        const tempFileName = path.join(__dirname, `${movieData.title}-${selectedLink.quality}.mp4`.replace(/[^a-z0-9\-_\.]/gi, '_'));
                        await reply("Downloading the movie, please wait... (This might take some time depending on the file size)");

                        try {
                            await downloadFile(selectedLink.link, tempFileName);
                        } catch (error) {
                            await reply(`Failed to download the movie file: ${error.message}`);
                            return;
                        }

                        // Step 8: Send the downloaded file as document
                        try {
                            await conn.sendMessage(from, {
                                document: fs.readFileSync(tempFileName),
                                mimetype: "video/mp4",
                                fileName: `${movieData.title} - ${selectedLink.quality}.mp4`,
                                caption: `🎬 *SOLO-LEVELING CINEMA* 🎥\n\nTitle: ${movieData.title}\nIMDB: ${movieData.imdb}\nDate: ${movieData.date}\nCountry: ${movieData.country}\nDuration: ${movieData.runtime}`
                            }, { quoted: qualityReplyMsg });
                        } catch (error) {
                            await reply(`Failed to send the movie file: ${error.message}`);
                        } finally {
                            // Delete temp file
                            fs.unlinkSync(tempFileName);
                        }

                    } else {
                        await reply("Invalid selection. Please reply with a valid number.");
                    }
                });

            } else {
                await reply("Invalid selection. Please reply with a valid number.");
            }
        });

    } catch (e) {
        console.error("Error during movie download:", e);
        reply(`*An error occurred while processing your request:* ${e.message}\n*Please try again later or use a different search term.*`);
    }
});
