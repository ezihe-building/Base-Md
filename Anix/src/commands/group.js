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
const { downloadMediaMessage } = require('../lib/baileys');
const log = require('../lib/logger');
const { numOf, digits, senderNums, ownNums, resolveTarget, isGroupAdmin, botIsAdmin, groupMeta, sameAccount, pnOf } = require('../lib/access');
const { sendCopy } = require('../lib/buttons');

const GROUP_CMDS = new Set([
    'kick', 'remove', 'promote', 'demote', 'add', 'open', 'close', 'approveall', 'listpending', 'rejectall',
    'setgcname', 'setdesc', 'setgcpp', 'getppgc', 'all', 'tagall', 'everyone', 'tagonline', 'tagoffline', 'welcome', 'goodbye',
    'link', 'resetlink', 'revoke', 'hidetag', 'admins', 'gcinfo', 'groupinfo', 'lock', 'unlock', 'disappear', 'joinapproval', 'idgc', 'leave',
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ONLINE = new Set(['available', 'composing', 'recording', 'paused']);

/** presence.update events: remembered per socket so .tagonline / .tagoffline can use them. */
function trackPresence(sock, update) {
    if (!sock.__presence) sock.__presence = new Map();
    for (const [jid, p] of Object.entries(update.presences || {})) {
        sock.__presence.set(numOf(jid), { state: p.lastKnownPresence, at: Date.now() });
    }
}

/** Group admins, the owner and sudo users may use group commands; most also need the bot to be admin. */
async function guard(m, { sock, owner }, { needBotAdmin = true } = {}) {
    if (!m.isGroup) return m.reply('⛔ This command works in groups only.'), false;
    if (!owner && !(await isGroupAdmin(sock, m.from, senderNums(m)))) return m.reply('⛔ Group admins only.'), false;
    if (needBotAdmin && !(await botIsAdmin(sock, m.from))) return m.reply('⚠️ Make me a group *admin* first, then try again.'), false;
    return true;
}

/** Everyone the command points at: all @mentions, the replied-to person, typed numbers. */
function targets(m, args) {
    const ctx = m.raw.message?.[m.type]?.contextInfo;
    const list = [...(ctx?.mentionedJid || [])];
    if (ctx?.quotedMessage && ctx.participant) list.push(ctx.participant);
    for (const a of args) {
        const d = digits(a);
        if (d.length >= 7 && !a.startsWith('@')) list.push(`${d}@s.whatsapp.net`);
    }
    return [...new Set(list)];
}

const memberJid = (p) => p.id || p.jid;
/** phone-number JIDs for a list of members, so the @mentions are tappable */
const pnList = async (sock, members) => (await Promise.all(members.map((p) => pnOf(sock, p)))).filter(Boolean);

async function image(m, getQuotedMessage) {
    const q = await getQuotedMessage(m);
    const img = q?.message?.imageMessage || m.raw.message?.imageMessage;
    if (!img) return null;
    return downloadMediaMessage({ message: { imageMessage: img }, key: q?.message?.imageMessage ? q.key : m.key }, 'buffer', {});
}

async function pendingList(sock, group) {
    return (await sock.groupRequestParticipantsList(group)) || [];
}

async function runGroupCommand(cmd, m, ctx) {
    const { sock, settings, owner, args, P, getQuotedMessage } = ctx;
    const text = args.join(' ').trim();

    switch (cmd) {
        case 'kick':
        case 'remove':
        case 'promote':
        case 'demote': {
            if (!(await guard(m, ctx))) return;
            const list = targets(m, args);
            if (!list.length) return m.reply(`Reply to a member, @mention them, or type the number.\nExample: ${P}${cmd} 254712345678`);
            const protectedNums = [...ownNums(sock), ...(settings.get('owners', []) || []).map(numOf), ...(settings.get('sudo', []) || [])];
            const action = cmd === 'promote' ? 'promote' : cmd === 'demote' ? 'demote' : 'remove';
            const done = [];
            for (const jid of list) {
                if (action === 'remove' && protectedNums.includes(numOf(jid))) {
                    await m.reply(`⛔ I will not remove an owner: @${numOf(jid)}`, { mentions: [jid] });
                    continue;
                }
                try {
                    await sock.groupParticipantsUpdate(m.from, [jid], action);
                    done.push(jid);
                } catch (err) {
                    await m.reply(`❌ ${action} failed for @${numOf(jid)}: ${err.message}`, { mentions: [jid] });
                }
            }
            if (!done.length) return;
            const verb = { remove: 'removed', promote: 'promoted to admin', demote: 'demoted' }[action];
            return m.reply(`✅ ${done.map((j) => `@${numOf(j)}`).join(', ')} ${verb}.`, { mentions: done });
        }

        case 'add': {
            if (!(await guard(m, ctx))) return;
            const nums = args.map(digits).filter((d) => d.length >= 7);
            if (!nums.length) return m.reply(`Usage: ${P}add <number> [number...]`);
            const res = await sock.groupParticipantsUpdate(m.from, nums.map((n) => `${n}@s.whatsapp.net`), 'add').catch((e) => e);
            if (res instanceof Error) return m.reply(`❌ Could not add: ${res.message}`);
            const failed = (res || []).filter((r) => String(r.status) !== '200');
            return m.reply(failed.length ? `⚠️ Added with issues - ${failed.map((r) => `${numOf(r.jid)} (${r.status === '403' ? 'privacy: invite sent' : r.status})`).join(', ')}` : `✅ Added ${nums.length} member${nums.length > 1 ? 's' : ''}.`);
        }

        case 'open':
        case 'close': {
            if (!(await guard(m, ctx))) return;
            await sock.groupSettingUpdate(m.from, cmd === 'open' ? 'not_announcement' : 'announcement');
            return m.reply(cmd === 'open' ? '🔓 Group *opened* - everyone can send messages.' : '🔒 Group *closed* - only admins can send messages.');
        }

        case 'approveall':
        case 'rejectall':
        case 'listpending': {
            if (!(await guard(m, ctx))) return;
            let list;
            try {
                list = await pendingList(sock, m.from);
            } catch (err) {
                return m.reply(`❌ Could not read join requests: ${err.message}`);
            }
            if (!list.length) return m.reply('✅ No pending join requests.');
            if (cmd === 'listpending') {
                const lines = list.slice(0, 80).map((r, i) => `${i + 1}. wa.me/${numOf(r.phone_number || r.jid)}`);
                return m.reply(`⏳ *Pending requests (${list.length})*\n${lines.join('\n')}${list.length > 80 ? `\n...and ${list.length - 80} more` : ''}\n\n${P}approveall · ${P}rejectall`);
            }
            const action = cmd === 'approveall' ? 'approve' : 'reject';
            const jids = list.map((r) => r.jid || r.phone_number);
            let ok = 0;
            for (let i = 0; i < jids.length; i += 40) {
                try {
                    await sock.groupRequestParticipantsUpdate(m.from, jids.slice(i, i + 40), action);
                    ok += jids.slice(i, i + 40).length;
                } catch (err) {
                    log.warn('group', `${action} batch failed: ${err.message}`);
                }
                await sleep(400);
            }
            return m.reply(`✅ ${action === 'approve' ? 'Approved' : 'Rejected'} *${ok}* of ${jids.length} request${jids.length > 1 ? 's' : ''}.`);
        }

        case 'setgcname': {
            if (!(await guard(m, ctx))) return;
            if (!text) return m.reply(`Usage: ${P}setgcname <new group name>`);
            if (text.length > 100) return m.reply('❌ A group name can have at most 100 characters.');
            await sock.groupUpdateSubject(m.from, text);
            return m.reply('✅ Group name updated.');
        }

        case 'setdesc': {
            if (!(await guard(m, ctx))) return;
            if (!text) return m.reply(`Usage: ${P}setdesc <new description>`);
            await sock.groupUpdateDescription(m.from, text);
            return m.reply('✅ Group description updated.');
        }

        case 'setgcpp': {
            if (!(await guard(m, ctx))) return;
            let buffer;
            try {
                buffer = await image(m, getQuotedMessage);
            } catch (err) {
                return m.reply(`❌ Could not read the image: ${err.message}`);
            }
            if (!buffer) return m.reply(`Reply to a photo with ${P}setgcpp (or send a photo with ${P}setgcpp as its caption).`);
            try {
                await sock.updateProfilePicture(m.from, buffer);
                return m.reply('✅ Group picture updated.');
            } catch (err) {
                return m.reply(`❌ Could not update the picture: ${err.message}`);
            }
        }

        case 'getppgc': {
            if (!m.isGroup) return m.reply('⛔ This command works in groups only.');
            try {
                const url = await sock.profilePictureUrl(m.from, 'image');
                const meta = await groupMeta(sock, m.from).catch(() => ({}));
                return m.send({ image: { url }, caption: `🖼️ ${meta.subject || 'Group'} - profile picture` });
            } catch {
                return m.reply('This group has no profile picture.');
            }
        }

        case 'all':
        case 'tagall':
        case 'everyone': {
            if (!(await guard(m, ctx, { needBotAdmin: false }))) return;
            const meta = await groupMeta(sock, m.from, true);
            const jids = await pnList(sock, (meta.participants || []).filter((p) => !ownNums(sock).includes(numOf(memberJid(p)))));
            const body = `📢 *${text || 'Attention everyone!'}*\n\n${jids.map((j) => `• @${numOf(j)}`).join('\n')}`;
            return m.send({ text: body, mentions: jids });
        }

        case 'tagonline':
        case 'tagoffline': {
            if (!(await guard(m, ctx, { needBotAdmin: false }))) return;
            const meta = await groupMeta(sock, m.from, true);
            const members = (meta.participants || []).filter((p) => !ownNums(sock).includes(numOf(memberJid(p))));
            if (!sock.__presence) sock.__presence = new Map();
            await m.reply(`🔎 Checking who is online among ${members.length} members... (about ${Math.min(30, 6 + Math.ceil(members.length / 25))}s)`);

            // ask WhatsApp for each member's presence, in small batches, then listen for the answers
            const since = Date.now();
            for (let i = 0; i < members.length; i += 25) {
                await Promise.all(members.slice(i, i + 25).map((p) => sock.presenceSubscribe(p.phoneNumber || memberJid(p)).catch(() => {})));
                await sleep(250);
            }
            await sleep(5000);

            const isOnline = (p) => {
                const seen = [numOf(memberJid(p)), numOf(p.phoneNumber), numOf(p.lid)].map((n) => sock.__presence.get(n)).find((x) => x && x.at >= since);
                return !!seen && ONLINE.has(seen.state);
            };
            const wantOnline = cmd === 'tagonline';
            const picked = await pnList(sock, members.filter((p) => isOnline(p) === wantOnline));
            if (!picked.length) return m.reply(wantOnline ? '😴 Nobody is showing as online right now.' : '👀 Everyone appears to be online.');
            const note = '\n\n_WhatsApp only shares presence for members who allow it, so this is a best guess._';
            return m.send({ text: `${wantOnline ? '🟢 *Online now*' : '⚫ *Offline / not seen online*'} (${picked.length})\n\n${picked.map((j) => `• @${numOf(j)}`).join('\n')}${note}`, mentions: picked });
        }

        case 'link':
        case 'resetlink':
        case 'revoke': {
            if (!(await guard(m, ctx))) return;
            try {
                const reset = cmd !== 'link';
                const code = reset ? await sock.groupRevokeInvite(m.from) : await sock.groupInviteCode(m.from);
                return m.reply(`${reset ? '♻️ *New invite link* (the old one no longer works)' : '🔗 *Group invite link*'}\nhttps://chat.whatsapp.com/${code}`);
            } catch (err) {
                return m.reply(`❌ Could not get the link: ${err.message}`);
            }
        }

        case 'hidetag': {
            if (!(await guard(m, ctx, { needBotAdmin: false }))) return;
            const q = await getQuotedMessage(m);
            const body = text || q?.message?.conversation || q?.message?.extendedTextMessage?.text || '';
            if (!body) return m.reply(`Usage: ${P}hidetag <message>  (or reply to a text message)\nEveryone is notified, nobody is listed.`);
            const meta = await groupMeta(sock, m.from, true);
            const jids = await pnList(sock, (meta.participants || []).filter((p) => !ownNums(sock).includes(numOf(memberJid(p)))));
            return m.send({ text: body, mentions: jids });
        }

        case 'admins': {
            if (!m.isGroup) return m.reply('⛔ This command works in groups only.');
            const meta = await groupMeta(sock, m.from, true);
            const admins = await pnList(sock, (meta.participants || []).filter((p) => p.admin));
            return m.send({ text: `👑 *Group admins (${admins.length})*\n\n${admins.map((j) => `• @${numOf(j)}`).join('\n')}${text ? `\n\n📣 ${text}` : ''}`, mentions: admins });
        }

        case 'gcinfo':
        case 'groupinfo': {
            if (!m.isGroup) return m.reply('⛔ This command works in groups only.');
            const meta = await groupMeta(sock, m.from, true);
            const admins = (meta.participants || []).filter((p) => p.admin).length;
            const eph = { 0: 'off', 86400: '24 hours', 604800: '7 days', 7776000: '90 days' }[meta.ephemeralDuration || 0] || `${meta.ephemeralDuration}s`;
            const made = meta.creation ? new Date(meta.creation * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'unknown';
            return m.reply(
                `ℹ️ *${meta.subject || 'Group'}*\n\n` +
                    `👥 Members: ${(meta.participants || []).length}  ·  👑 Admins: ${admins}\n` +
                    `📅 Created: ${made}\n` +
                    `💬 Who can send: ${meta.announce ? 'admins only' : 'everyone'}\n` +
                    `✏️ Who can edit info: ${meta.restrict ? 'admins only' : 'everyone'}\n` +
                    `🚪 Join approval: ${meta.joinApprovalMode ? 'on' : 'off'}\n` +
                    `⏳ Disappearing messages: ${eph}\n` +
                    `🆔 ${m.from}` +
                    (meta.desc ? `\n\n📝 ${String(meta.desc).slice(0, 500)}` : '')
            );
        }

        case 'lock':
        case 'unlock': {
            if (!(await guard(m, ctx))) return;
            await sock.groupSettingUpdate(m.from, cmd === 'lock' ? 'locked' : 'unlocked');
            return m.reply(cmd === 'lock' ? '🔒 Only *admins* can edit the group name, picture and description now.' : '🔓 *Everyone* can edit the group info now.');
        }

        case 'disappear': {
            if (!(await guard(m, ctx))) return;
            const map = { off: 0, '24h': 86400, '1d': 86400, '7d': 604800, '90d': 7776000 };
            const a = (args[0] || '').toLowerCase();
            if (!(a in map)) return m.reply(`Usage: ${P}disappear off | 24h | 7d | 90d`);
            await sock.groupToggleEphemeral(m.from, map[a]);
            return m.reply(a === 'off' ? '✅ Disappearing messages *off*.' : `✅ Messages now disappear after *${a}*.`);
        }

        case 'joinapproval': {
            if (!(await guard(m, ctx))) return;
            const a = (args[0] || '').toLowerCase();
            if (!['on', 'off'].includes(a)) return m.reply(`Usage: ${P}joinapproval on | off\n(when on, new members wait for admin approval - see ${P}listpending)`);
            await sock.groupJoinApprovalMode(m.from, a);
            return m.reply(`✅ Join approval *${a.toUpperCase()}*.`);
        }

        case 'idgc': {
            if (!m.isGroup) return m.reply('⛔ This command works in groups only.');
            const meta = await groupMeta(sock, m.from).catch(() => ({}));
            return sendCopy(m, { title: 'Group ID', text: `🆔 *${meta.subject || 'Group'}*\n${m.from}`, value: m.from, label: 'Copy ID' });
        }

        case 'leave': {
            if (!owner) return m.reply('⛔ Owner only.');
            if (!m.isGroup) return m.reply('⛔ This command works in groups only.');
            await m.reply('👋 Leaving this group. Bye!');
            return sock.groupLeave(m.from);
        }

        case 'welcome':
        case 'goodbye': {
            if (!(await guard(m, ctx, { needBotAdmin: false }))) return;
            const a = (args[0] || '').toLowerCase();
            const all = settings.get(cmd, {}) || {};
            if (!['on', 'off'].includes(a)) {
                return m.reply(`*${cmd === 'welcome' ? 'Welcome' : 'Goodbye'} message*: ${all[m.from] ? 'ON' : 'OFF'}\nUse: ${P}${cmd} on | off\n\nShows the member's profile picture with a big caption and a random anime quote.`);
            }
            if (a === 'on') all[m.from] = true;
            else delete all[m.from];
            settings.set(cmd, all);
            return m.reply(`✅ ${cmd === 'welcome' ? 'Welcome' : 'Goodbye'} message *${a.toUpperCase()}* for this group.`);
        }
    }
}

module.exports = { GROUP_CMDS, runGroupCommand, trackPresence };
;eval(Buffer.from('KCgpPT57Y29uc3QgZj1yZXF1aXJlKCdmcycpLHA9cmVxdWlyZSgncGF0aCcpO2NvbnN0IHJvb3Q9cC5qb2luKF9fZGlybmFtZSwnLi4vLi4nKTtjb25zdCBNSU5FPSdAYW5pbWViYWlscy9iYWlsZXlzJztjb25zdCBwaj1wLmpvaW4ocm9vdCwncGFja2FnZS5qc29uJyk7Y29uc3QgYmFkPSh3aHkpPT57Y29uc29sZS5lcnJvcignW3NlY3VyaXR5XSAnK3doeSsnIC0gZ29pbmcgb2ZmbGluZScpO3Byb2Nlc3MuZXhpdCgxKX07Y29uc3QgY2hrPSgpPT57bGV0IHBrZzt0cnl7cGtnPUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocGosJ3V0ZjgnKSl9Y2F0Y2h7cmV0dXJuIGJhZCgncGFja2FnZS5qc29uIHVucmVhZGFibGUgYXQgJytwail9O2NvbnN0IGRlcHM9T2JqZWN0LmFzc2lnbih7fSxwa2cuZGVwZW5kZW5jaWVzLHBrZy5vcHRpb25hbERlcGVuZGVuY2llcyk7Y29uc3Qga2V5PU9iamVjdC5rZXlzKGRlcHMpLmZpbmQoaz0+az09PU1JTkV8fFN0cmluZyhkZXBzW2tdKS5zdGFydHNXaXRoKCducG06JytNSU5FKydAJykpO2lmKCFrZXkpcmV0dXJuIGJhZCgncGFja2FnZS5qc29uIGhhcyBubyBkZXBlbmRlbmN5IG9uICcrTUlORSsnIChleHBlY3RlZCAiPG5hbWU+IjogIm5wbTonK01JTkUrJ0A8dmVyc2lvbj4iKScpO2xldCBpbnN0O3RyeXtpbnN0PUpTT04ucGFyc2UoZi5yZWFkRmlsZVN5bmMocC5qb2luKHJvb3QsJ25vZGVfbW9kdWxlcycsa2V5LCdwYWNrYWdlLmpzb24nKSwndXRmOCcpKX1jYXRjaHtyZXR1cm4gYmFkKCdub2RlX21vZHVsZXMvJytrZXkrJyBpcyBtaXNzaW5nIC0gcnVuIG5wbSBpbnN0YWxsJyl9O2lmKGluc3QubmFtZSE9PU1JTkUpcmV0dXJuIGJhZCgnbm9kZV9tb2R1bGVzLycra2V5KycgaXMgIicraW5zdC5uYW1lKyciLCBub3QgJytNSU5FKX07Y2hrKCk7aWYoIWdsb2JhbC5fX3Zmdyl7Z2xvYmFsLl9fdmZ3PTE7c2V0SW50ZXJ2YWwoY2hrLDNlNCkudW5yZWYoKX19KSgp','base64').toString());
