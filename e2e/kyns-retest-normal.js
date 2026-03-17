const https = require('https');

const BASE = process.env.KYNS_BASE_URL || 'http://localhost:3080';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const PROMPTS = [
  'Me explica o que é machine learning em 3 frases',
  'Escreve um haiku sobre São Paulo',
  'Quais os prós e contras de morar sozinho?',
  'Me recomenda 3 livros de ficção científica',
];

function httpReq(url, opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function streamSSE(url, token, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    let fullText = '';
    let finishReason = '?';
    let resolved = false;
    let eventCount = 0;
    let rawEvents = [];

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        req.destroy();
        resolve({ text: fullText, finishReason: 'timeout', totalMs: Date.now() - start, eventCount, rawEvents });
      }
    }, timeoutMs);

    const req = https.request(url, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token, Accept: 'text/event-stream', 'User-Agent': UA },
    }, (res) => {
      let buf = '';
      res.on('data', (chunk) => {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            eventCount++;
            if (eventCount <= 5) rawEvents.push(JSON.stringify(evt).slice(0, 300));

            if (evt.final === true) {
              clearTimeout(timer);
              const rm = evt.responseMessage;
              if (rm) {
                if (rm.text) fullText = rm.text;
                else if (rm.content && Array.isArray(rm.content)) {
                  for (const p of rm.content) {
                    if (p?.type === 'text' && p?.text) fullText = p.text;
                  }
                }
                finishReason = rm.finish_reason || 'stop';
              }
              if (!resolved) {
                resolved = true;
                resolve({ text: fullText, finishReason, totalMs: Date.now() - start, eventCount, rawEvents });
              }
              req.destroy();
              return;
            }
          } catch (_) {}
        }
      });
      res.on('end', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({ text: fullText, finishReason: 'stream_end', totalMs: Date.now() - start, eventCount, rawEvents });
        }
      });
    });
    req.on('error', () => {
      if (!resolved) { resolved = true; clearTimeout(timer); resolve({ text: '', finishReason: 'error', totalMs: Date.now() - start, eventCount, rawEvents }); }
    });
    req.end();
  });
}

async function main() {
  const email = process.env.KYNS_TEST_EMAIL;
  const password = process.env.KYNS_TEST_PASSWORD;
  if (!email || !password) {
    console.error('Error: KYNS_TEST_EMAIL and KYNS_TEST_PASSWORD environment variables are required.');
    process.exit(1);
  }
  const loginData = JSON.stringify({ email, password });
  const lr = await httpReq(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData), 'User-Agent': UA },
  }, loginData);
  const token = JSON.parse(lr.body).token;
  console.log('Auth OK\n');

  for (let i = 0; i < PROMPTS.length; i++) {
    const prompt = PROMPTS[i];
    console.log(`Test ${i + 1}: "${prompt}"`);

    const chatBody = JSON.stringify({
      text: prompt, endpoint: 'KYNS', endpointType: 'openAI', spec: 'kyns',
      model: 'llmfan46/Qwen3.5-27B-heretic-v2', modelLabel: 'KYNS',
      conversationId: 'new', messageId: crypto.randomUUID(),
      responseMessageId: crypto.randomUUID(),
      parentMessageId: '00000000-0000-0000-0000-000000000000',
      isContinued: false, isRegenerate: false,
    });

    const cr = await httpReq(BASE + '/api/agents/chat/KYNS', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(chatBody), 'User-Agent': UA, Authorization: 'Bearer ' + token },
    }, chatBody);
    const parsed = JSON.parse(cr.body);
    if (!parsed.streamId) { console.log('  NO STREAM:', cr.body.slice(0, 200)); continue; }

    const result = await streamSSE(BASE + '/api/agents/chat/stream/' + parsed.streamId, token, 120000);
    const preview = (result.text || '').slice(0, 200).replace(/\n/g, ' ');
    console.log(`  ${result.text.length}ch | ${(result.totalMs / 1000).toFixed(1)}s | finish:${result.finishReason} | events:${result.eventCount}`);
    console.log(`  text: ${preview || '(empty)'}`);
    if (result.text.length === 0 && result.rawEvents.length > 0) {
      console.log('  First events:', result.rawEvents.slice(0, 3).join('\n  '));
    }
    console.log();
  }
}

main().catch(console.error);
