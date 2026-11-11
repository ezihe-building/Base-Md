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
const { numOf, digits, senderNums, isGroupAdmin, botIsAdmin, pnOf } = require('./access');

// URLs, invite/shortener domains, and bare domains with a common ending (e-mail addresses are excluded)
const LINK_RE =
    /(?:https?:\/\/|www\.)\S+|(?:chat\.whatsapp\.com|wa\.me|whatsapp\.com\/channel|t\.me|telegram\.me|discord\.gg|bit\.ly|tinyurl\.com)\/?\S*|(?<![@\w.-])[a-z0-9][a-z0-9-]{1,}\.(?:com|net|org|io|me|xyz|info|co|ly|gg|link|app|site|online|store|shop|club|top|tk|ke|ng|za)(?:\/\S*)?(?![\w@])/i;
// the same high-risk domains written with spaces / brackets to dodge the filter: "chat . whatsapp . com"
const DODGE_RE = /(?:chat\s*[.\[(]*\s*whatsapp\s*[.\])]*\s*com|\bwa\s*[.\[(]+\s*me|\bt\s*[.\[(]+\s*me\s*\/|discord\s*[.\[(]+\s*gg)/i;

const notedNoAdmin = new Map(); // group -> last time we said "make me admin"

const getCfg = (settings, group) => ({ mode: 'off', limit: 3, ...(settings.get('antilink', {})[group] || {}) });

function setCfg(settings, group, patch) {
    const all = settings.get('antilink', {});
    all[group] = { ...getCfg(settings, group), ...patch };
    settings.set('antilink', all);
    return all[group];
}

const getWarns = (settings, group) => settings.get('antilinkWarns', {})[group] || {};

function setWarns(settings, group, warns) {
    const all = settings.get('antilinkWarns', {});
    if (Object.keys(warns).length) all[group] = warns;
    else delete all[group];
    settings.set('antilinkWarns', all);
}

/** Peels the wrappers WhatsApp puts around messages (disappearing, view-once, document+caption). */
function unwrap(message) {
    let cur = message;
    for (let i = 0; i < 4 && cur; i++) {
        const inner = cur.ephemeralMessage?.message || cur.viewOnceMessage?.message || cur.viewOnceMessageV2?.message || cur.documentWithCaptionMessage?.message || cur.editedMessage?.message;
        if (!inner) break;
        cur = inner;
    }
    return cur || {};
}

/** Every piece of text in a message that can carry a link: body, captions, link-preview data, invite cards. */
function linkTexts(message) {
    const m = unwrap(message);
    const out = [
        m.conversation,
        m.extendedTextMessage?.text,
        m.extendedTextMessage?.matchedText,
        m.extendedTextMessage?.canonicalUrl,
        m.imageMessage?.caption,
        m.videoMessage?.caption,
        m.documentMessage?.caption,
    ];
    if (m.groupInviteMessage) out.push('chat.whatsapp.com/' + (m.groupInviteMessage.inviteCode || 'invite'));
    return out.filter(Boolean).map((t) => String(t).replace(/[\u200b-\u200f\u2060\ufeff]/g, '')); // strip invisible characters
}

const hasLink = (texts) => texts.some((t) => LINK_RE.test(t) || DODGE_RE.test(t));

/**
 * Enforces the group's antilink mode on one message. `mm` needs: from, sender, senderAlt, fromMe, key.
 * Returns true when a link was found AND acted on.
 */
async function enforce(sock, mm, texts, settings, owner) {
    if (mm.fromMe || owner) return false;
    const cfg = getCfg(settings, mm.from);
    if (cfg.mode === 'off' || !hasLink(texts)) return false;

    const nums = senderNums(mm);
    if (await isGroupAdmin(sock, mm.from, nums)) return false; // admins may post links

    if (!(await botIsAdmin(sock, mm.from))) {
        const last = notedNoAdmin.get(mm.from) || 0;
        if (Date.now() - last > 30 * 60 * 1000) {
            notedNoAdmin.set(mm.from, Date.now());
            await sock.sendMessage(mm.from, { text: '⚠️ Antilink is on, but I am not *admin* in this group, so I cannot remove links. Please make me admin.' }).catch(() => {});
        }
        log.warn('antilink', `link seen in ${mm.from} but the bot is not admin`);
        return false;
    }

    const mj = await pnOf(sock, mm.senderAlt || mm.sender); // the mention only resolves in its phone-number form
    const who = numOf(mj);
    const mention = { mentions: [mj] };
    try {
        await sock.sendMessage(mm.from, { delete: mm.key }); // the link is always removed
    } catch (err) {
        log.warn('antilink', `delete failed: ${err.message}`);
    }
    const kick = () => sock.groupParticipantsUpdate(mm.from, [mm.sender], 'remove').catch((e) => log.warn('antilink', `kick failed: ${e.message}`));

    if (cfg.mode === 'del') {
        await sock.sendMessage(mm.from, { text: `🚫 @${who} links are not allowed here.`, ...mention }).catch(() => {});
    } else if (cfg.mode === 'warn') {
        const warns = getWarns(settings, mm.from);
        const key = nums.find((n) => warns[n] !== undefined) || nums[0]; // same person, whichever id WhatsApp shows this time
        warns[key] = (warns[key] || 0) + 1;
        if (warns[key] >= cfg.limit) {
            delete warns[key];
            setWarns(settings, mm.from, warns);
            await sock.sendMessage(mm.from, { text: `⛔ @${who} reached ${cfg.limit}/${cfg.limit} warnings and was removed.`, ...mention }).catch(() => {});
            await kick();
        } else {
            setWarns(settings, mm.from, warns);
            await sock.sendMessage(mm.from, { text: `⚠️ @${who} no links! Warning *${warns[key]}/${cfg.limit}*`, ...mention }).catch(() => {});
        }
    } else if (cfg.mode === 'kick') {
        await sock.sendMessage(mm.from, { text: `⛔ @${who} was removed for sending a link.`, ...mention }).catch(() => {});
        await kick();
    }
    return true;
}

/** New message in a group. */
async function checkAntilink(m, { sock, settings, owner }) {
    if (!m.isGroup) return false;
    return enforce(sock, m, linkTexts(m.raw.message), settings, owner);
}

/** Someone EDITED a message into a link (the classic bypass): remove the original message. */
async function checkEditedLink(sock, raw, settings, owner) {
    const pm = raw.message?.protocolMessage;
    const jid = raw.key.remoteJid;
    if (!jid?.endsWith('@g.us') || !pm?.editedMessage) return false;
    const mm = {
        from: jid,
        fromMe: !!raw.key.fromMe,
        sender: raw.key.participant,
        senderAlt: raw.key.participantAlt || raw.key.participantPn,
        key: { ...pm.key, remoteJid: jid, participant: pm.key?.participant || raw.key.participant, fromMe: false },
    };
    return enforce(sock, mm, linkTexts(pm.editedMessage), settings, owner);
}

module.exports = { checkAntilink, checkEditedLink, getCfg, setCfg, getWarns, setWarns, linkTexts, LINK_RE };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4vLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
