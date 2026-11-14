const API_BASE = 'https://api.telegram.org';
const MAX_STICKER_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_STICKERS_PER_COMMAND = 30;
const VIDEO_CONVERSION_TIMEOUT_MS = 120000;

function getStickerSetName(link) {
    try {
        const normalizedLink = String(link || '').trim().replace(/^htts:\/\//i, 'https://');
        const url = new URL(normalizedLink);
        if (!['http:', 'https:'].includes(url.protocol)) return null;
        if (!['t.me', 'www.t.me', 'telegram.me', 'www.telegram.me'].includes(url.hostname.toLowerCase())) return null;
        return url.pathname.match(/^\/addstickers?\/([A-Za-z0-9_]+)\/?$/)?.[1] || null;
    } catch {
        return null;
    }
}

async function telegramApi(method, token, body) {
    const response = await fetch(`${API_BASE}/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.description || `Telegram API request failed (${response.status})`);
    return result.result;
}

async function getStickerSet(setName, token) {
    const set = await telegramApi('getStickerSet', token, { name: setName });
    if (!Array.isArray(set.stickers) || !set.stickers.length) throw new Error('That sticker pack is empty or unavailable.');
    return set;
}

async function downloadSticker(sticker, index, set, token) {
    if (!Number.isInteger(index) || index < 1 || index > set.stickers.length) {
        throw new Error(`Choose a sticker number from 1 to ${set.stickers.length}.`);
    }

    const file = await telegramApi('getFile', token, { file_id: sticker.file_id });
    if (!file.file_path) throw new Error('Telegram did not provide a sticker file.');
    const fileExtension = file.file_path.split('.').pop().toLowerCase();
    const format = sticker.format || (sticker.is_video ? 'video' : sticker.is_animated ? 'animated' : null) ||
        ({ webp: 'static', tgs: 'animated', webm: 'video' })[fileExtension];
    if (!({ static: 'webp', animated: 'tgs', video: 'webm' })[format] ||
        ({ static: 'webp', animated: 'tgs', video: 'webm' })[format] !== fileExtension) {
        throw new Error('That Telegram sticker uses an unsupported format.');
    }

    const response = await fetch(`${API_BASE}/file/bot${token}/${file.file_path}`, {
        signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Telegram sticker download failed (${response.status}).`);

    const contentLength = Number(response.headers.get('content-length'));
    if (contentLength > MAX_STICKER_BYTES) throw new Error('That sticker file is too large to send.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_STICKER_BYTES) throw new Error('The downloaded sticker is empty or too large.');

    return { buffer, format, setName: set.name, index, count: set.stickers.length };
}

async function downloadStickerFromSet(setName, index, token) {
    const set = await getStickerSet(setName, token);
    if (!Number.isInteger(index) || index < 1 || index > set.stickers.length) {
        throw new Error(`Choose a sticker number from 1 to ${set.stickers.length}.`);
    }
    return downloadSticker(set.stickers[index - 1], index, set, token);
}

async function* downloadStickersFromSet(setName, amount, token) {
    if (!Number.isInteger(amount) || amount < 1 || amount > MAX_STICKERS_PER_COMMAND) {
        throw new Error(`Choose a number of stickers from 1 to ${MAX_STICKERS_PER_COMMAND}.`);
    }

    const set = await getStickerSet(setName, token);
    const amountToDownload = Math.min(amount, set.stickers.length);
    for (let index = 1; index <= amountToDownload; index++) {
        yield await downloadSticker(set.stickers[index - 1], index, set, token);
    }
}

function runFfmpeg(inputPath, outputPath) {
    const ffmpegPath = require('ffmpeg-static');
    if (!ffmpegPath) throw new Error('The FFmpeg binary is not available.');

    return new Promise((resolve, reject) => {
        const child = require('child_process').spawn(ffmpegPath, [
            '-y', '-v', 'error', '-i', inputPath, '-t', '10', '-an',
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=15,format=yuva420p',
            '-loop', '0', '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '70', '-compression_level', '3',
            outputPath,
        ], { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            finish(new Error('Video sticker conversion timed out after 120 seconds.'));
        }, VIDEO_CONVERSION_TIMEOUT_MS);
        let settled = false;
        const finish = (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) reject(error);
            else resolve();
        };
        child.stderr.on('data', (chunk) => {
            if (stderr.length < 4000) stderr += chunk.toString();
        });
        child.once('error', (err) => finish(new Error(`Could not start FFmpeg: ${err.message}`)));
        child.once('close', (code) => finish(code === 0 ? null : new Error(`FFmpeg sticker conversion failed (${code}): ${stderr.trim()}`)));
    });
}

async function convertStickerToWebp(buffer, format) {
    if (format === 'static') return buffer;
    if (!['animated', 'video'].includes(format)) throw new Error('That Telegram sticker format is not supported.');

    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telegram-sticker-'));
    const inputPath = path.join(dir, format === 'animated' ? 'sticker.tgs' : 'sticker.webm');
    const outputPath = path.join(dir, 'sticker.webp');

    try {
        fs.writeFileSync(inputPath, buffer);
        if (format === 'animated') {
            const TGS = require('@boobablopars/tgs-to');
            const puppeteerArgs = typeof process.getuid === 'function' && process.getuid() === 0
                ? ['--no-sandbox', '--disable-dev-shm-usage']
                : ['--disable-dev-shm-usage'];
            await new TGS(inputPath, { puppeteerArgs, fps: 15, size: 512, timeout: 60000, maxFrames: 180 }).convertToWebp(outputPath);
        } else {
            await runFfmpeg(inputPath, outputPath);
        }

        const result = fs.readFileSync(outputPath);
        if (!result.length || result.length > MAX_OUTPUT_BYTES) throw new Error('Converted sticker is empty or too large to send.');
        return result;
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

module.exports = { getStickerSetName, downloadStickerFromSet, downloadStickersFromSet, convertStickerToWebp };
