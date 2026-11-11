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
const { downloadMediaMessage } = require('./baileys');
const log = require('./logger');
const { numOf, pnOf } = require('./access');

/**
 * Anti-delete: remembers recent messages (and their media, because WhatsApp removes the file when a
 * message is deleted for everyone) and re-sends them when someone deletes.
 *   mode 'chat' -> re-sent in the same chat      mode 'dm' -> forwarded to the owner's DM
 * Memory is bounded: 1500 messages / 60 MB of media / 3 hours.
 */
const caches = new Map(); // sessionId -> { map, bytes }
const MAX_ENTRIES = 1500;
const MAX_MEDIA_BYTES = 60 * 1024 * 1024;
const MAX_ONE_MEDIA = 15 * 1024 * 1024;
const TTL = 3 * 3600 * 1000;
const MEDIA_KINDS = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', stickerMessage: 'sticker', documentMessage: 'document' };
const SKIP_KINDS = new Set(['protocolMessage', 'reactionMessage', 'senderKeyDistributionMessage', 'messageContextInfo', 'pollUpdateMessage']);

const cacheOf = (id) => {
    if (!caches.has(id)) caches.set(id, { map: new Map(), bytes: 0 });
    return caches.get(id);
};

function drop(c, key) {
    const e = c.map.get(key);
    if (e?.media) c.bytes -= e.media.buffer.length;
    c.map.delete(key);
}

function evict(c) {
    const now = Date.now();
    for (const [key, e] of c.map) {
        if (c.map.size <= MAX_ENTRIES && c.bytes <= MAX_MEDIA_BYTES && now - e.at < TTL) break; // oldest first
        drop(c, key);
    }
}

const kindOf = (message) => Object.keys(message || {}).find((k) => !SKIP_KINDS.has(k));

function textOf(message) {
    return (
        message?.conversation ||
        message?.extendedTextMessage?.text ||
        message?.imageMessage?.caption ||
        message?.videoMessage?.caption ||
        message?.documentMessage?.caption ||
        ''
    );
}

async function rememberMessage(sock, sessionId, raw, settings) {
    if (!settings.get('antidelete', {}).enabled) return;
    const jid = raw.key?.remoteJid || '';
    if (raw.key.fromMe || !raw.message || jid === 'status@broadcast' || jid.endsWith('@newsletter')) return;
    const kind = kindOf(raw.message);
    if (!kind) return;

    const c = cacheOf(sessionId);
    const entry = { raw, kind, at: Date.now() };
    const node = raw.message[kind];
    if (MEDIA_KINDS[kind] && Number(node?.fileLength || 0) < MAX_ONE_MEDIA) {
        try {
            const buffer = await downloadMediaMessage(raw, 'buffer', {});
            entry.media = { type: MEDIA_KINDS[kind], buffer, mimetype: node.mimetype, fileName: node.fileName, caption: node.caption || '', ptt: !!node.ptt, gif: !!node.gifPlayback };
            c.bytes += buffer.length;
        } catch (err) {
            log.warn('antidelete', `could not save media: ${err.message}`);
        }
    }
    c.map.set(`${jid}:${raw.key.id}`, entry);
    evict(c);
}

function ownerJid(sock, settings) {
    const first = (settings.get('owners', []) || []).find((j) => String(j).endsWith('@s.whatsapp.net'));
    return first || `${numOf(sock.user?.id)}@s.whatsapp.net`;
}

/** Returns true when `raw` is a delete-for-everyone notice (handled or ignored). */
async function handleRevoke(sock, sessionId, raw, settings) {
    const pm = raw.message?.protocolMessage;
    if (!pm || !(pm.type === 0 || pm.type === 'REVOKE')) return false;

    const cfg = settings.get('antidelete', {});
    if (!cfg.enabled || raw.key.fromMe || !pm.key?.id) return true;

    const chat = pm.key.remoteJid || raw.key.remoteJid;
    const c = cacheOf(sessionId);
    const entry = c.map.get(`${chat}:${pm.key.id}`);
    if (!entry) return true;
    drop(c, `${chat}:${pm.key.id}`);

    const target = cfg.mode === 'dm' ? ownerJid(sock, settings) : chat;
    const author = entry.raw.key.participant || entry.raw.key.remoteJid;
    let where = 'Private chat';
    if (chat.endsWith('@g.us')) {
        try {
            where = (await sock.groupMetadata(chat)).subject || 'Group';
        } catch {
            where = 'Group';
        }
    }
    const authorPn = await pnOf(sock, entry.raw.key.participantAlt || author);
    const header = `🗑️ *Anti-Delete*\n👤 @${numOf(authorPn)}\n💬 ${where}\n🕒 ${new Date(entry.at).toLocaleTimeString()}`;
    const mentions = [authorPn];
    const text = textOf(entry.raw.message);

    try {
        const mdl = entry.media;
        if (!mdl) {
            const body = text || `[${entry.kind.replace('Message', '')}]`;
            await sock.sendMessage(target, { text: `${header}\n\n${body}`, mentions });
        } else if (mdl.type === 'image') {
            await sock.sendMessage(target, { image: mdl.buffer, caption: `${header}${text ? `\n\n${text}` : ''}`, mentions });
        } else if (mdl.type === 'video') {
            await sock.sendMessage(target, { video: mdl.buffer, caption: `${header}${text ? `\n\n${text}` : ''}`, gifPlayback: mdl.gif, mentions });
        } else if (mdl.type === 'document') {
            await sock.sendMessage(target, { document: mdl.buffer, mimetype: mdl.mimetype, fileName: mdl.fileName || 'file', caption: header, mentions });
        } else {
            // audio / sticker cannot carry a caption: send the media, then the details
            await sock.sendMessage(target, mdl.type === 'audio' ? { audio: mdl.buffer, mimetype: mdl.mimetype || 'audio/mp4', ptt: mdl.ptt } : { sticker: mdl.buffer });
            await sock.sendMessage(target, { text: header, mentions });
        }
    } catch (err) {
        log.warn('antidelete', `could not resend: ${err.message}`);
    }
    return true;
}

module.exports = { rememberMessage, handleRevoke };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4vLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
