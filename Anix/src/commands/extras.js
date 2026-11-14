const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const QRCode = require('qrcode');

const reminderTimers = new Map();
const activeGames = new Map();
const MAX_REMINDER_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_000_000;
const MAX_STICKER_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_STICKER_BYTES = 1024 * 1024;

function parseDuration(value) {
    const match = String(value || '').match(/^(\d+)(s|m|h|d)$/i);
    if (!match) return null;
    const amount = Number(match[1]);
    const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2].toLowerCase()];
    const duration = amount * unit;
    return Number.isSafeInteger(duration) && duration > 0 ? duration : null;
}

function getReminders(settings) {
    const reminders = settings.get('reminders', []);
    return Array.isArray(reminders) ? reminders : [];
}

function calculate(expression) {
    if (expression.length > 120) throw new Error('Keep calculations under 120 characters.');
    const tokens = [];
    const pattern = /\s*(?:(\d+(?:\.\d*)?|\.\d+)|([()+\-*/%^]))/y;
    let position = 0;
    while (position < expression.length) {
        pattern.lastIndex = position;
        const match = pattern.exec(expression);
        if (!match) throw new Error('Use numbers, parentheses, and + - * / % ^ only.');
        tokens.push(match[1] !== undefined ? Number(match[1]) : match[2]);
        position = pattern.lastIndex;
        if (tokens.length > 100) throw new Error('That calculation is too long.');
    }

    let cursor = 0;
    const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 4 };
    function primary() {
        const token = tokens[cursor++];
        if (token === '+' || token === '-') {
            const value = expressionAt(3);
            return token === '-' ? -value : value;
        }
        if (token === '(') {
            const value = expressionAt(0);
            if (tokens[cursor++] !== ')') throw new Error('Check the parentheses in that calculation.');
            return value;
        }
        if (typeof token !== 'number' || !Number.isFinite(token)) throw new Error('That calculation is incomplete.');
        return token;
    }
    function expressionAt(minPrecedence) {
        let left = primary();
        while (typeof tokens[cursor] === 'string' && precedence[tokens[cursor]] >= minPrecedence) {
            const operator = tokens[cursor++];
            const level = precedence[operator];
            const right = expressionAt(level + (operator === '^' ? 0 : 1));
            if (operator === '+') left += right;
            else if (operator === '-') left -= right;
            else if (operator === '*') left *= right;
            else if (operator === '/') {
                if (right === 0) throw new Error('Division by zero is undefined.');
                left /= right;
            } else if (operator === '%') {
                if (right === 0) throw new Error('Modulo by zero is undefined.');
                left %= right;
            } else left **= right;
        }
        if (!Number.isFinite(left)) throw new Error('That calculation is outside the supported range.');
        return left;
    }

    if (!tokens.length) throw new Error('Enter a calculation, e.g. .calc (12 + 8) * 3.');
    const result = expressionAt(0);
    if (cursor !== tokens.length) throw new Error('There is an unexpected value in that calculation.');
    return result;
}

function scheduleReminder(sock, session, reminder) {
    const key = `${session.sessionId}:${reminder.id}`;
    clearTimeout(reminderTimers.get(key));
    const delay = Math.min(MAX_TIMEOUT_MS, Math.max(0, reminder.dueAt - Date.now()));
    const timer = setTimeout(async () => {
        reminderTimers.delete(key);
        if (reminder.dueAt > Date.now()) {
            scheduleReminder(sock, session, reminder);
            return;
        }
        try {
            await sock.sendMessage(reminder.chat, { text: `⏰ Reminder: ${reminder.text}` });
            const current = getReminders(session.settings).filter((item) => item?.id);
            session.settings.set('reminders', current.filter((item) => item.id !== reminder.id));
        } catch (err) {
            console.error(`[reminder:${session.sessionId}] delivery failed: ${err.message}`);
        }
    }, delay);
    timer.unref?.();
    reminderTimers.set(key, timer);
}

function restoreReminders(sock, session) {
    for (const reminder of getReminders(session.settings)) {
        if (!reminder?.id || !reminder.chat || !reminder.text || !Number.isFinite(reminder.dueAt)) continue;
        scheduleReminder(sock, session, reminder);
    }
}

function fetchJson(url, timeoutMs = 12000) {
    return fetch(url, { signal: AbortSignal.timeout(timeoutMs) }).then(async (response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status}).`);
        return response.json();
    });
}

async function convertToSticker(buffer, isVideo) {
    const ffmpegPath = require('ffmpeg-static');
    if (!ffmpegPath) throw new Error('FFmpeg is unavailable on this server.');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-sticker-'));
    const input = path.join(dir, isVideo ? 'input.mp4' : 'input.jpg');
    const output = path.join(dir, 'sticker.webp');
    try {
        fs.writeFileSync(input, buffer);
        const filters = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000';
        const args = isVideo
            ? ['-y', '-v', 'error', '-i', input, '-t', '6', '-an', '-vf', `${filters},fps=12,format=yuva420p`, '-loop', '0', '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '55', '-compression_level', '3', output]
            : ['-y', '-v', 'error', '-i', input, '-frames:v', '1', '-vf', `${filters},format=yuva420p`, '-c:v', 'libwebp', '-lossless', '0', '-q:v', '75', '-compression_level', '3', output];
        await new Promise((resolve, reject) => {
            const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
            let stderr = '';
            const timer = setTimeout(() => {
                child.kill('SIGKILL');
                finish(new Error('Sticker conversion timed out.'));
            }, 60000);
            let settled = false;
            const finish = (error) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (error) reject(error);
                else resolve();
            };
            child.stderr.on('data', (chunk) => {
                if (stderr.length < 3000) stderr += chunk.toString();
            });
            child.once('error', (err) => finish(new Error(`Could not start FFmpeg: ${err.message}`)));
            child.once('close', (code) => finish(code === 0 ? null : new Error(`FFmpeg failed (${code}): ${stderr.trim()}`)));
        });
        const result = fs.readFileSync(output);
        if (result.length > MAX_STICKER_BYTES) throw new Error('That sticker is over WhatsApp’s 1 MB limit.');
        if (result.subarray(0, 4).toString() !== 'RIFF' || result.subarray(8, 12).toString() !== 'WEBP') {
            throw new Error('FFmpeg did not produce a valid WebP sticker.');
        }
        return result;
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

const randomItem = (items) => items[crypto.randomInt(items.length)];
const jokes = [
    'I tried to write a joke about recursion, but it kept calling itself.',
    'Why did the phone wear glasses? It lost its contacts.',
    'My calendar and I are done. Its days are numbered.',
];
const facts = [
    'A day on Venus is longer than its year.',
    'Octopuses have three hearts.',
    'Honey can remain edible for thousands of years when stored well.',
];
const quotes = [
    'Small steps still move you forward.',
    'Make progress, then make it better.',
    'A calm mind can solve what a rushed one misses.',
];
const truths = ['What is one skill you wish you had?', 'What is your funniest harmless mistake?', 'What song do you secretly love?'];
const dares = ['Send a kind message to someone you appreciate.', 'Describe your day using only three emojis.', 'Do your best robot voice for ten seconds.'];
const trivia = [
    { question: 'Which planet is known as the Red Planet?', answer: 'mars' },
    { question: 'How many sides does a hexagon have?', answer: '6' },
    { question: 'What is the largest ocean on Earth?', answer: 'pacific' },
];

async function runExtraCommand(cmd, m, { args, sock, session, owner, getQuotedMessage, downloadMediaMessage }) {
    const { settings, sessionId } = session;
    const text = args.join(' ').trim();

    switch (cmd) {
        case 'getpfp':
            return false;

        case 'checkdevice': {
            if (!owner) {
                await m.reply('⛔ Only the bot owner can inspect the bot’s linked-session diagnostics.');
                return true;
            }
            const account = sock.user?.id || 'unknown';
            await m.reply(`📱 *Bot session diagnostics*\nAccount: wa.me/${String(account).split('@')[0].split(':')[0]}\nConnection: online\nTransport: linked WhatsApp Web session\nServer: Node.js ${process.version} on ${process.platform}`);
            return true;
        }

        case 'calc': {
            try {
                await m.reply(`🧮 ${calculate(text)}`);
            } catch (err) {
                await m.reply(`❌ ${err.message}`);
            }
            return true;
        }

        case 'roll':
        case 'dice': {
            const match = (args[0] || '1d6').match(/^(\d*)d(\d+)$/i);
            if (!match) {
                await m.reply('Usage: .roll [count]d[sides] (e.g. .roll 2d6).');
                return true;
            }
            const count = Number(match[1] || 1);
            const sides = Number(match[2]);
            if (count < 1 || count > 20 || sides < 2 || sides > 1000) {
                await m.reply('Use 1–20 dice with 2–1000 sides each.');
                return true;
            }
            const rolls = Array.from({ length: count }, () => crypto.randomInt(1, sides + 1));
            await m.reply(`🎲 ${rolls.join(' + ')} = ${rolls.reduce((sum, value) => sum + value, 0)}`);
            return true;
        }

        case 'coinflip':
        case 'flip':
            await m.reply(`🪙 ${crypto.randomInt(2) ? 'Heads' : 'Tails'}!`);
            return true;

        case 'choose': {
            const options = text.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
            if (options.length < 2 || options.length > 20) {
                await m.reply('Usage: .choose option one | option two | option three');
                return true;
            }
            await m.reply(`🤔 I choose: *${randomItem(options)}*`);
            return true;
        }

        case '8ball':
        case 'magic8ball': {
            if (!text) {
                await m.reply('Ask a question first, e.g. .8ball will I ace my test?');
                return true;
            }
            await m.reply(`🎱 ${randomItem(['Definitely!', 'Looks promising.', 'Ask again later.', 'Probably not.', 'Absolutely not.'])}`);
            return true;
        }

        case 'rps': {
            const choices = ['rock', 'paper', 'scissors'];
            const userChoice = (args[0] || '').toLowerCase();
            if (!choices.includes(userChoice)) {
                await m.reply('Usage: .rps rock | paper | scissors');
                return true;
            }
            const botChoice = randomItem(choices);
            const outcome = userChoice === botChoice ? 'It’s a tie!' :
                ((userChoice === 'rock' && botChoice === 'scissors') ||
                (userChoice === 'paper' && botChoice === 'rock') ||
                (userChoice === 'scissors' && botChoice === 'paper') ? 'You win!' : 'I win!');
            await m.reply(`✊ You: ${userChoice}\n🤖 Me: ${botChoice}\n${outcome}`);
            return true;
        }

        case 'joke':
            await m.reply(`😄 ${randomItem(jokes)}`);
            return true;

        case 'fact':
            await m.reply(`🧠 ${randomItem(facts)}`);
            return true;

        case 'quote':
            await m.reply(`💬 “${randomItem(quotes)}”`);
            return true;

        case 'truth':
            await m.reply(`🟦 Truth: ${randomItem(truths)}`);
            return true;

        case 'dare':
            await m.reply(`🟥 Dare: ${randomItem(dares)}`);
            return true;

        case 'guess': {
            const game = activeGames.get(m.from);
            if (!text) {
                const number = crypto.randomInt(1, 21);
                activeGames.set(m.from, { type: 'guess', number });
                await m.reply('🎯 I picked a number from 1 to 20. Send .guess <number> to play.');
                return true;
            }
            if (!game || game.type !== 'guess') {
                await m.reply('Start a round first with .guess');
                return true;
            }
            const guess = Number(args[0]);
            if (!Number.isInteger(guess) || guess < 1 || guess > 20) {
                await m.reply('Guess a whole number from 1 to 20.');
                return true;
            }
            if (guess === game.number) {
                activeGames.delete(m.from);
                await m.reply('🎉 Correct! You got it.');
            } else {
                await m.reply(guess < game.number ? 'Too low—try again!' : 'Too high—try again!');
            }
            return true;
        }

        case 'trivia': {
            const question = randomItem(trivia);
            activeGames.set(m.from, { type: 'trivia', answer: question.answer });
            await m.reply(`🧠 Trivia: ${question.question}\nReply with .answer <your answer>`);
            return true;
        }

        case 'answer': {
            const game = activeGames.get(m.from);
            if (!game || game.type !== 'trivia') {
                await m.reply('Start a trivia round first with .trivia');
                return true;
            }
            if (!text) {
                await m.reply('Usage: .answer <your answer>');
                return true;
            }
            if (text.toLowerCase().trim() === game.answer) {
                activeGames.delete(m.from);
                await m.reply('✅ Correct!');
            } else {
                await m.reply('Not quite—try again.');
            }
            return true;
        }

        case 'ship':
        case 'rate': {
            const subject = text || m.pushName || 'you';
            await m.reply(`💖 ${subject}: *${crypto.randomInt(101)}%*`);
            return true;
        }

        case 'reverse':
            await m.reply(text ? Array.from(text).reverse().join('') : 'Usage: .reverse <text>');
            return true;

        case 'count':
            if (!text) await m.reply('Usage: .count <text>');
            else await m.reply(`🔢 Characters: ${Array.from(text).length}\nWords: ${text.trim().split(/\s+/).length}`);
            return true;

        case 'upper':
        case 'uppercase':
            await m.reply(text ? text.toLocaleUpperCase() : 'Usage: .upper <text>');
            return true;

        case 'lower':
        case 'lowercase':
            await m.reply(text ? text.toLocaleLowerCase() : 'Usage: .lower <text>');
            return true;

        case 'base64': {
            const action = (args[0] || '').toLowerCase();
            const value = args.slice(1).join(' ');
            if (!value || !['encode', 'decode'].includes(action)) {
                await m.reply('Usage: .base64 encode <text> or .base64 decode <base64>');
                return true;
            }
            if (action === 'encode') {
                await m.reply(Buffer.from(value, 'utf8').toString('base64'));
                return true;
            }
            const normalized = value.replace(/\s/g, '');
            if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) {
                await m.reply('That is not valid Base64.');
                return true;
            }
            await m.reply(Buffer.from(normalized, 'base64').toString('utf8'));
            return true;
        }

        case 'hash':
            if (!text) await m.reply('Usage: .hash <text>');
            else await m.reply(`SHA-256: ${crypto.createHash('sha256').update(text).digest('hex')}`);
            return true;

        case 'uuid':
            await m.reply(crypto.randomUUID());
            return true;

        case 'timestamp': {
            const date = text ? new Date(text) : new Date();
            if (!Number.isFinite(date.getTime())) {
                await m.reply('Usage: .timestamp [date or time]');
                return true;
            }
            await m.reply(`🕒 ${date.toISOString()}\nUnix: ${Math.floor(date.getTime() / 1000)}`);
            return true;
        }

        case 'weather': {
            if (!text) {
                await m.reply('Usage: .weather <city>');
                return true;
            }
            try {
                const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
                geoUrl.search = new URLSearchParams({ name: text, count: '1', language: 'en', format: 'json' });
                const geo = await fetchJson(geoUrl);
                const place = geo.results?.[0];
                if (!place) {
                    await m.reply('I couldn’t find that place. Try a nearby city name.');
                    return true;
                }
                const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
                forecastUrl.search = new URLSearchParams({
                    latitude: String(place.latitude),
                    longitude: String(place.longitude),
                    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
                    timezone: 'auto',
                });
                const forecast = await fetchJson(forecastUrl);
                const current = forecast.current;
                if (!current) throw new Error('Weather data was unavailable.');
                await m.reply(`🌦️ *${place.name}${place.country ? `, ${place.country}` : ''}*\n${weatherDescription(current.weather_code)}\nTemperature: ${current.temperature_2m}°C (feels like ${current.apparent_temperature}°C)\nHumidity: ${current.relative_humidity_2m}%\nWind: ${current.wind_speed_10m} km/h`);
            } catch (err) {
                await m.reply(`❌ Weather lookup failed: ${err.message}`);
            }
            return true;
        }

        case 'translate': {
            const [targetLanguage, ...words] = args;
            const sourceText = words.join(' ');
            if (!targetLanguage || !/^[a-z]{2}(?:-[A-Z]{2})?$/i.test(targetLanguage) || !sourceText || sourceText.length > 500) {
                await m.reply('Usage: .translate <language code> <text>\nExample: .translate es Hello, how are you?');
                return true;
            }
            try {
                const url = new URL('https://api.mymemory.translated.net/get');
                url.search = new URLSearchParams({ q: sourceText, langpair: `autodetect|${targetLanguage}` });
                const result = await fetchJson(url);
                const translated = result.responseData?.translatedText;
                if (result.responseStatus !== 200 || !translated) throw new Error(result.responseDetails || 'No translation was returned.');
                await m.reply(`🌐 ${translated}`);
            } catch (err) {
                await m.reply(`❌ Translation failed: ${err.message}`);
            }
            return true;
        }

        case 'qr':
        case 'qrcode': {
            if (!text || text.length > 1000) {
                await m.reply('Usage: .qr <text or link> (up to 1000 characters)');
                return true;
            }
            const image = await QRCode.toBuffer(text, { type: 'png', width: 512, margin: 2 });
            await m.send({ image, caption: '📱 QR code' });
            return true;
        }

        case 'poll': {
            if (!m.isGroup) {
                await m.reply('Polls can only be created in a group chat.');
                return true;
            }
            const parts = text.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean);
            if (parts.length < 3 || parts.length > 13 || parts.some((part) => part.length > 100)) {
                await m.reply('Usage: .poll question | option 1 | option 2 (up to 12 options)');
                return true;
            }
            await m.send({ poll: { name: parts[0].slice(0, 256), values: parts.slice(1), selectableCount: 1 } });
            return true;
        }

        case 'remind': {
            const duration = parseDuration(args[0]);
            const reminderText = args.slice(1).join(' ').trim();
            if (!duration || duration > MAX_REMINDER_MS || !reminderText) {
                await m.reply('Usage: .remind <duration> <text>\nExample: .remind 30m call mum (maximum 30 days)');
                return true;
            }
            const reminders = getReminders(settings);
            if (reminders.filter((item) => item.chat === m.from && item.user === m.sender).length >= 25) {
                await m.reply('You already have 25 reminders in this chat. Cancel one before adding another.');
                return true;
            }
            const reminder = {
                id: crypto.randomUUID().slice(0, 8),
                chat: m.from,
                user: m.sender,
                text: reminderText.slice(0, 300),
                dueAt: Date.now() + duration,
            };
            settings.set('reminders', [...reminders, reminder]);
            scheduleReminder(sock, session, reminder);
            await m.reply(`⏰ Reminder set for ${new Date(reminder.dueAt).toLocaleString()}. ID: ${reminder.id}`);
            return true;
        }

        case 'reminders': {
            const reminders = getReminders(settings).filter((item) => item.chat === m.from && item.user === m.sender);
            await m.reply(reminders.length
                ? reminders.map((item) => `${item.id} — ${new Date(item.dueAt).toLocaleString()}: ${item.text}`).join('\n')
                : 'You have no reminders in this chat.');
            return true;
        }

        case 'cancelreminder': {
            const id = args[0];
            const reminders = getReminders(settings);
            const match = reminders.find((item) => item.id === id && item.chat === m.from && (item.user === m.sender || owner));
            if (!match) {
                await m.reply('Reminder not found in this chat. Use .reminders to see your IDs.');
                return true;
            }
            clearTimeout(reminderTimers.get(`${sessionId}:${match.id}`));
            reminderTimers.delete(`${sessionId}:${match.id}`);
            settings.set('reminders', reminders.filter((item) => item.id !== match.id));
            await m.reply(`✅ Reminder ${match.id} cancelled.`);
            return true;
        }

        case 'goodnight': {
            if (!owner) {
                await m.reply('⛔ Only the bot owner can pause AI auto-replies.');
                return true;
            }
            const duration = args[0] ? parseDuration(args[0]) : 8 * 60 * 60 * 1000;
            if (!duration || duration > 24 * 60 * 60 * 1000) {
                await m.reply('Usage: .goodnight [duration up to 24h]\nExample: .goodnight 8h');
                return true;
            }
            const until = Date.now() + duration;
            settings.set('quietUntil', until);
            await m.reply(`🌙 AI auto-replies paused until ${new Date(until).toLocaleTimeString()}. Use .goodmorning to resume early.`);
            return true;
        }

        case 'goodmorning':
            if (!owner) {
                await m.reply('⛔ Only the bot owner can resume AI auto-replies.');
                return true;
            }
            settings.set('quietUntil', 0);
            await m.reply('☀️ AI auto-replies are active again.');
            return true;

        case 'jid':
        case 'chatid':
            await m.reply(`Chat ID: ${m.from}\nYour ID: ${m.sender}`);
            return true;

        case 'sticker': {
            const quoted = await getQuotedMessage(m);
            const sourceMessage = quoted?.message || m.raw.message;
            const sourceKey = quoted?.key || m.key;
            const image = sourceMessage?.imageMessage;
            const video = sourceMessage?.videoMessage;
            if (!image && !video) {
                await m.reply('Reply to a photo or short video with .sticker.');
                return true;
            }
            const mediaSize = Number((image || video).fileLength);
            if (Number.isFinite(mediaSize) && mediaSize > MAX_STICKER_INPUT_BYTES) {
                await m.reply('That media is too large to convert. The limit is 20 MB.');
                return true;
            }
            try {
                const type = image ? 'imageMessage' : 'videoMessage';
                const buffer = await downloadMediaMessage({ message: { [type]: image || video }, key: sourceKey }, 'buffer', {});
                const sticker = await convertToSticker(buffer, Boolean(video));
                await m.send({ sticker });
            } catch (err) {
                await m.reply(`❌ Sticker conversion failed: ${err.message}`);
            }
            return true;
        }

        default:
            return false;
    }
}

function weatherDescription(code) {
    if (code === 0) return 'Clear sky';
    if ([1, 2, 3].includes(code)) return 'Partly cloudy';
    if ([45, 48].includes(code)) return 'Fog';
    if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
    if ([95, 96, 99].includes(code)) return 'Thunderstorm';
    return 'Current conditions';
}

module.exports = { runExtraCommand, restoreReminders, calculate, parseDuration, convertToSticker };
