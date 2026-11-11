/**
 * Telegram Premium custom emoji helper.
 *
 * Wraps a known fallback emoji (e.g. "✅") as a <tg-emoji emoji-id="..."> tag.
 * Users with Telegram Premium see the special animated/premium version of the
 * emoji; everyone else just sees the plain fallback character, so this is
 * always safe to send. It ONLY works with parse_mode: 'HTML' — messages that
 * use tg() must be sent with { parse_mode: 'HTML' }.
 *
 * Usage:
 *   const { tg, escapeHtml } = require('./emojis');
 *   await ctx.reply(`${tg('✅')} Done.`, { parse_mode: 'HTML' });
 *   await ctx.reply(`${tg('❌')} Failed: ${escapeHtml(err.message)}`, { parse_mode: 'HTML' });
 *
 * escapeHtml() must wrap any interpolated value that didn't come from this
 * file's own hardcoded strings (user text, error messages, names) — Telegram
 * rejects the whole message if the HTML entities don't parse cleanly.
 */
const fs = require('fs');
const path = require('path');

const PACK = JSON.parse(fs.readFileSync(path.join(__dirname, 'emojis.json'), 'utf8'));
const byFallback = new Map(PACK.map((e) => [e.fallback, e.id]));

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// fallback -> "<tg-emoji emoji-id="...">fallback</tg-emoji>", or just the
// plain emoji back if it isn't in the pack (so this is always safe to call).
function tg(fallback) {
    const id = byFallback.get(fallback);
    return id ? `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>` : fallback;
}

module.exports = { tg, escapeHtml, PACK };
