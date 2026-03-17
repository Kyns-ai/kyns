const https = require('https');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function httpReq(url, opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function test() {
  const email = process.env.KYNS_TEST_EMAIL;
  const password = process.env.KYNS_TEST_PASSWORD;
  const baseUrl = process.env.KYNS_BASE_URL || 'http://localhost:3080';
  if (!email || !password) {
    console.error('Error: KYNS_TEST_EMAIL and KYNS_TEST_PASSWORD environment variables are required.');
    process.exit(1);
  }
  const loginData = JSON.stringify({ email, password });
  const loginResp = await httpReq(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData), 'User-Agent': UA },
  }, loginData);
  const token = JSON.parse(loginResp.body).token;
  console.log('Token OK');

  const chatBody = JSON.stringify({
    text: 'Oi',
    endpoint: 'KYNS',
    spec: 'kyns',
    model: 'llmfan46/Qwen3.5-27B-heretic-v2',
    modelLabel: 'KYNS',
    conversationId: 'new',
    messageId: crypto.randomUUID(),
    responseMessageId: crypto.randomUUID(),
    parentMessageId: '00000000-0000-0000-0000-000000000000',
    isContinued: false,
    isRegenerate: false,
  });
  const chatResp = await httpReq('https://chat.kyns.ai/api/agents/chat/KYNS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(chatBody),
      'User-Agent': UA,
      Authorization: 'Bearer ' + token,
    },
  }, chatBody);
  console.log('Chat POST status:', chatResp.status);
  console.log('Chat POST body:', chatResp.body.slice(0, 300));

  if (chatResp.status !== 200) return;
  const parsed = JSON.parse(chatResp.body);
  if (!parsed.streamId) {
    console.log('No streamId');
    return;
  }
  console.log('streamId:', parsed.streamId);

  // Subscribe to SSE
  return new Promise((resolve) => {
    const sseReq = https.request(
      'https://chat.kyns.ai/api/agents/chat/stream/' + parsed.streamId,
      {
        method: 'GET',
        headers: { Authorization: 'Bearer ' + token, Accept: 'text/event-stream', 'User-Agent': UA },
      },
      (res) => {
        let buf = '';
        let count = 0;
        const start = Date.now();
        const timer = setTimeout(() => {
          console.log('TIMEOUT after 60s');
          sseReq.destroy();
          resolve();
        }, 60000);

        res.on('data', (chunk) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              count++;
              if (evt.final) {
                clearTimeout(timer);
                const rm = evt.responseMessage;
                const elapsed = ((Date.now() - start) / 1000).toFixed(1);
                console.log('FINAL text:', (rm?.text || '').slice(0, 500));
                console.log('finish_reason:', rm?.finish_reason);
                console.log('Events:', count, '| Time:', elapsed + 's');
                sseReq.destroy();
                resolve();
              }
            } catch (_) {
              // skip parse errors
            }
          }
        });
        res.on('end', () => {
          clearTimeout(timer);
          console.log('Stream ended, events:', count);
          resolve();
        });
      },
    );
    sseReq.on('error', (e) => {
      console.error('SSE error:', e.message);
      resolve();
    });
    sseReq.end();
  });
}

test().catch(console.error);
