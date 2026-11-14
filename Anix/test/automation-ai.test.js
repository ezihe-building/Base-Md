const assert = require('node:assert/strict');
const test = require('node:test');

const { chatReply, clearHistory } = require('../src/lib/chatbot');
const { apiGet } = require('../src/lib/api');
const { handleStatus } = require('../src/lib/status');
const { serializeMessage } = require('../src/lib/serializer');

test('AI keeps recent turns, preserves useful-length answers, and supports clearing chat memory', async () => {
    const originalFetch = global.fetch;
    const prompts = [];
    const responses = ['A'.repeat(900), 'The answer is orange.', 'Fresh conversation.'];
    global.fetch = async (input) => {
        prompts.push(new URL(input).searchParams.get('teks'));
        const response = responses.shift();
        return new Response(JSON.stringify({ status: true, result: { response } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        });
    };

    const sessionId = `test-session-${Date.now()}`;
    const chat = 'test-chat';
    clearHistory(sessionId, chat);
    try {
        const firstRequest = chatReply(sessionId, chat, 'Remember that my favorite color is orange.');
        const secondRequest = chatReply(sessionId, chat, 'What is my favorite color?');
        const [first, second] = await Promise.all([firstRequest, secondRequest]);
        assert.equal(first.length, 900);

        assert.equal(second, 'The answer is orange.');
        assert.match(prompts[1], /Remember that my favorite color is orange/);
        assert.ok(prompts[1].includes('A'.repeat(900)));

        clearHistory(sessionId, chat);
        await chatReply(sessionId, chat, 'Start fresh.');
        assert.doesNotMatch(prompts[2], /favorite color is orange/);
    } finally {
        clearHistory(sessionId, chat);
        global.fetch = originalFetch;
    }
});

test('AI API failures report HTTP and JSON errors clearly', async () => {
    const originalFetch = global.fetch;
    try {
        global.fetch = async () => new Response('<html>maintenance</html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
        });
        await assert.rejects(apiGet('/ai/unliai'), /API returned invalid JSON with HTTP 200/);

        global.fetch = async () => new Response('unavailable', { status: 503 });
        await assert.rejects(apiGet('/ai/unliai'), /API request failed with HTTP 503/);
    } finally {
        global.fetch = originalFetch;
    }
});

test('new status view and reaction are started immediately and reaction targets only the poster', () => {
    const calls = [];
    const poster = '12345@s.whatsapp.net';
    const key = {
        remoteJid: 'status@broadcast',
        id: `status-${Date.now()}`,
        participant: poster,
    };
    const sock = {
        readMessages(keys) {
            calls.push(['view', keys]);
            return Promise.resolve();
        },
        sendMessage(...args) {
            calls.push(['like', args]);
            return Promise.resolve();
        },
    };
    const settings = {
        get(name, fallback) {
            return ({
                autoStatusView: true,
                autoStatusLike: true,
                statusEmojis: ['🔥'],
            })[name] ?? fallback;
        },
    };

    assert.equal(handleStatus(sock, { key, message: { conversation: 'status text' } }, settings, 'session-a'), true);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], ['view', [key]]);
    assert.equal(calls[1][0], 'like');
    assert.equal(calls[1][1][0], 'status@broadcast');
    assert.deepEqual(calls[1][1][1].react, { text: '🔥', key });
    assert.deepEqual(calls[1][1][2].statusJidList, [poster]);

    handleStatus(sock, { key, message: { conversation: 'duplicate delivery' } }, settings, 'session-a');
    assert.equal(calls.length, 2);
});

test('serializer recognizes text wrapped in an ephemeral message', () => {
    const message = {
        key: { remoteJid: '12345@s.whatsapp.net', id: 'wrapped-message', fromMe: false },
        message: {
            ephemeralMessage: {
                message: { conversation: 'hello from an expiring chat' },
            },
        },
    };
    const settings = { get: () => null };
    const serialized = serializeMessage({}, message, settings);

    assert.equal(serialized.type, 'conversation');
    assert.equal(serialized.body, 'hello from an expiring chat');
});
