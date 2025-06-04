// lib/reply-tracker.js

const replyTrackers = new Map();

function addReplyTracker(conn) {
    conn._replyHandlers = replyTrackers;

    conn.addReplyTracker = function (messageID, handler) {
        if (!messageID || typeof handler !== "function") return;
        replyTrackers.set(messageID, handler);
    };

    conn.handleReply = async function (mek) {
        const messageID = mek.message?.extendedTextMessage?.contextInfo?.stanzaId || mek.key?.id;
        if (!messageID) return;

        const handler = replyTrackers.get(messageID);
        if (handler) {
            try {
                await handler(mek, mek.message?.conversation || mek.message?.extendedTextMessage?.text || '');
            } catch (err) {
                console.error("Error in reply handler:", err);
            }
        }
    };
}

module.exports = addReplyTracker;
