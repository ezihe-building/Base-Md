#!/usr/bin/env node
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
 * vf.js - READ-ONLY Baileys monitor. It never edits package.json, never runs npm and never touches
 * node_modules. The source files do not need it (they read package.json themselves) - it is optional.
 *
 * Every check it only REPORTS (console, plus Telegram if BOT_TOKEN + OWNER_TELEGRAM_ID are in .env):
 *   1. package.json has a dependency on your Baileys package, under any name
 *   2. node_modules really contains that package (and which version)
 *   3. a newer version of your package exists on npm            (it is not installed)
 *   4. the upstream Baileys changed (new version / dist-tag)    (it is not installed)
 *
 * Usage:   node vf.js            check every 10 min, forever
 *          node vf.js --once     check once and exit
 *
 * Env (all optional): VF_PACKAGE (default @animebails/baileys), VF_UPSTREAM (default @whiskeysockets/baileys,
 *                     comma separated), VF_INTERVAL_MIN (default 10), VF_REGISTRY.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MINE = process.env.VF_PACKAGE || '@animebails/baileys';
const UPSTREAM = (process.env.VF_UPSTREAM || '@whiskeysockets/baileys').split(',').map((s) => s.trim()).filter(Boolean);
const REGISTRY = (process.env.VF_REGISTRY || 'https://registry.npmjs.org').replace(/\/$/, '');
const INTERVAL_MS = Math.max(1, Number(process.env.VF_INTERVAL_MIN) || 10) * 60 * 1000;
const STATE = path.join(ROOT, '.vf-state.json');
const ONCE = process.argv.includes('--once');

const log = (msg) => console.log(`[vf ${new Date().toTimeString().slice(0, 8)}] ${msg}`);
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } };
const writeState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));

const getJson = async (url) => {
    const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`registry returned ${res.status} for ${url}`);
    return res.json();
};
const distTags = (name) => getJson(`${REGISTRY}/-/package/${name}/dist-tags`);

function envValue(key) {
    if (process.env[key]) return process.env[key];
    try {
        const line = fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).find((l) => l.startsWith(key + '='));
        return line ? line.slice(key.length + 1).trim() : '';
    } catch { return ''; }
}

async function notify(text) {
    log(text);
    const token = envValue('BOT_TOKEN');
    const chat = envValue('OWNER_TELEGRAM_ID');
    if (!token || !chat) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: chat, text: '[vf] ' + text }),
            signal: AbortSignal.timeout(15000),
        });
    } catch { /* alerts are best-effort */ }
}

function isNewer(a, b) {
    const pa = a.split('-')[0].split('.').map(Number);
    const pb = b.split('-')[0].split('.').map(Number);
    for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    return false;
}

async function check() {
    // 1 + 2: straight from package.json and node_modules
    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')); }
    catch (err) { return notify(`package.json unreadable: ${err.message}`); }

    const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
    const key = Object.keys(deps).find((k) => k === MINE || String(deps[k]).startsWith(`npm:${MINE}@`));
    if (!key) return notify(`package.json has no dependency on ${MINE} (expected "<name>": "npm:${MINE}@<version>")`);

    let installed = null;
    try { installed = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', key, 'package.json'), 'utf8')); } catch { /* not installed */ }
    if (!installed) await notify(`node_modules/${key} is missing - run npm install`);
    else if (installed.name !== MINE) await notify(`node_modules/${key} is "${installed.name}", not ${MINE}`);
    else log(`${MINE} ${installed.version} installed as "${key}" (${deps[key]})`);

    // 3: newer version of yours? (report only)
    try {
        const latest = (await distTags(MINE)).latest;
        const state = readState();
        if (installed && latest && isNewer(latest, installed.version) && state.notifiedLatest !== latest) {
            await notify(`${MINE} ${latest} is available (installed ${installed.version}). Nothing was changed - update when you are ready.`);
            writeState({ ...readState(), notifiedLatest: latest });
        }
    } catch (err) { log(`could not read ${MINE} from the registry: ${err.message}`); }

    // 4: upstream changes (report only)
    for (const name of UPSTREAM) {
        try {
            const tags = await distTags(name);
            const state = readState();
            const prev = state.upstream?.[name];
            writeState({ ...state, upstream: { ...(state.upstream || {}), [name]: tags } });
            if (!prev) { log(`watching ${name}: ${JSON.stringify(tags)}`); continue; }
            const changes = [...new Set([...Object.keys(prev), ...Object.keys(tags)])]
                .filter((t) => prev[t] !== tags[t])
                .map((t) => `${t}: ${prev[t] || '(none)'} -> ${tags[t] || '(removed)'}`);
            if (changes.length) await notify(`UPSTREAM CHANGE in ${name} - ${changes.join(', ')}`);
        } catch (err) { log(`upstream check failed for ${name}: ${err.message}`); }
    }
}

(async () => {
    await check();
    if (ONCE) return;
    log(`watching every ${INTERVAL_MS / 60000} min (read-only). Ctrl+C to stop.`);
    setInterval(() => check().catch((e) => log('check failed: ' + e.message)), INTERVAL_MS);
})();
