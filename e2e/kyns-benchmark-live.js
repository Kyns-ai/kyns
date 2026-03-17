#!/usr/bin/env node
/**
 * KYNS Live Benchmark — hits production API, measures timing/quality/looping.
 * Usage: node e2e/kyns-benchmark-live.js
 */
const https = require('https');
const http = require('http');

const BASE = process.env.KYNS_BASE_URL || 'http://localhost:3080';
const EMAIL = process.env.KYNS_TEST_EMAIL;
const PASSWORD = process.env.KYNS_TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Error: KYNS_TEST_EMAIL and KYNS_TEST_PASSWORD environment variables are required.');
  console.error('Copy e2e/.env.e2e.example to e2e/.env.e2e and fill in your credentials.');
  process.exit(1);
}
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const NORMAL_PROMPTS = [
  'Fala aí, quanto é 2+2?',
  'Me explica o que é machine learning em 3 frases',
  'Escreve um haiku sobre São Paulo',
  'Quais os prós e contras de morar sozinho?',
  'Me conta uma piada curta',
  'O que é estoicismo?',
  'Dá uma dica de produtividade pra quem trabalha remoto',
  'Traduz "the quick brown fox jumps over the lazy dog" pro português',
  'Me recomenda 3 livros de ficção científica',
  'Qual a diferença entre TCP e UDP?',
];

const DEEP_PROMPTS = [
  'Quanto é 2+2? Responda apenas o número.',
  'Me explica a Alegoria da Caverna de Platão e como ela se aplica às redes sociais hoje',
  'Compara vantagens e desvantagens de morar em Portugal vs Espanha pra um dev remoto brasileiro',
  'Qual a melhor estrutura societária pra um brasileiro que fatura em dólares com produtos digitais?',
  'Escreve uma cena de 200 palavras de um thriller psicológico',
  'Me dá 3 argumentos contra e 3 a favor da IA substituir empregos criativos',
  'Explica o dilema do prisioneiro e como ele aparece em negociações reais',
  'Analisa o mercado de IA no Brasil: oportunidades e riscos pra 2026',
  'Me explica como funciona um transformer em linguagem simples',
  'Qual a diferença real entre coaching e terapia? Sem bullshit.',
];

const DEEP_TIMEOUT_MS = 300_000; // 5 min max per deep test
const NORMAL_TIMEOUT_MS = 120_000; // 2 min max per normal test

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function login() {
  const data = JSON.stringify({ email: EMAIL, password: PASSWORD });
  const resp = await httpRequest(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'User-Agent': UA },
  }, data);
  const parsed = JSON.parse(resp.body);
  if (!parsed.token) throw new Error(`Login failed: ${resp.body.slice(0, 200)}`);
  return parsed.token;
}

function streamSSE(url, token, timeoutMs) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const startTime = Date.now();
    let fullText = '';
    let finishReason = '?';
    let ttft = null;
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        req.destroy();
        resolve({
          text: fullText,
          finishReason: 'timeout',
          ttft,
          totalMs: Date.now() - startTime,
        });
      }
    }, timeoutMs);

    const req = mod.request(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream', 'User-Agent': UA },
    }, (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));

            // Detect text content
            if (evt.text != null && evt.text !== '') {
              if (ttft === null) ttft = Date.now() - startTime;
              fullText += evt.text;
            }

            // Check for content delta
            if (evt.event === 'message.delta' || evt.type === 'message.delta') {
              const delta = evt.data?.delta || evt.delta;
              if (delta?.content) {
                const parts = Array.isArray(delta.content) ? delta.content : [delta.content];
                for (const part of parts) {
                  if (part?.text) {
                    if (ttft === null) ttft = Date.now() - startTime;
                    fullText += part.text;
                  }
                }
              }
            }

            // Check for content parts in aggregated content
            if (evt.content && Array.isArray(evt.content)) {
              for (const part of evt.content) {
                if (part?.type === 'text' && part?.text) {
                  fullText = part.text; // replace with aggregated
                }
              }
            }

            // Final event
            if (evt.final === true) {
              const respMsg = evt.responseMessage;
              if (respMsg) {
                // Extract final text
                if (respMsg.text) fullText = respMsg.text;
                else if (respMsg.content && Array.isArray(respMsg.content)) {
                  for (const p of respMsg.content) {
                    if (p?.type === 'text' && p?.text) fullText = p.text;
                  }
                }
                finishReason = respMsg.finish_reason || respMsg.finishReason || 'stop';
              }
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                resolve({
                  text: fullText,
                  finishReason,
                  ttft,
                  totalMs: Date.now() - startTime,
                });
              }
              return;
            }
          } catch (_) { /* ignore parse errors */ }
        }
      });
      res.on('end', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve({
            text: fullText,
            finishReason: finishReason || 'stream_end',
            ttft,
            totalMs: Date.now() - startTime,
          });
        }
      });
    });
    req.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    req.end();
  });
}

async function sendChat(token, prompt, spec) {
  const convId = crypto.randomUUID();
  const msgId = crypto.randomUUID();
  const respMsgId = crypto.randomUUID();

  const body = JSON.stringify({
    text: prompt,
    endpoint: 'KYNS',
    endpointType: 'openAI',
    spec: spec,
    model: 'llmfan46/Qwen3.5-27B-heretic-v2',
    modelLabel: spec === 'kyns-deep' ? 'KYNS Deep' : 'KYNS',
    conversationId: 'new',
    messageId: msgId,
    responseMessageId: respMsgId,
    parentMessageId: '00000000-0000-0000-0000-000000000000',
    isContinued: false,
    isRegenerate: false,
  });

  const resp = await httpRequest(`${BASE}/api/agents/chat/KYNS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': UA,
      Authorization: `Bearer ${token}`,
    },
  }, body);

  if (resp.status !== 200) {
    throw new Error(`Chat POST failed: ${resp.status} ${resp.body.slice(0, 300)}`);
  }

  const parsed = JSON.parse(resp.body);
  if (!parsed.streamId) {
    // Might be a blocked response
    if (parsed.blocked) {
      return { text: parsed.responseMessage?.text || 'BLOCKED', finishReason: 'blocked', ttft: 0, totalMs: 0 };
    }
    throw new Error(`No streamId: ${resp.body.slice(0, 300)}`);
  }

  const startTime = Date.now();
  const timeoutMs = spec === 'kyns-deep' ? DEEP_TIMEOUT_MS : NORMAL_TIMEOUT_MS;
  const result = await streamSSE(`${BASE}/api/agents/chat/stream/${parsed.streamId}`, token, timeoutMs);

  return result;
}

function detectLooping(text) {
  if (!text || text.length < 200) return false;
  // Check for repeated emoji sequences
  const emojiRun = text.match(/(.)\1{20,}/);
  if (emojiRun) return true;
  // Check for repeated character blocks
  const last200 = text.slice(-200);
  const uniqueChars = new Set(last200).size;
  if (uniqueChars < 10 && last200.length > 100) return true;
  // Check for repeated words/phrases
  const words = text.split(/\s+/).slice(-50);
  if (words.length >= 20) {
    const lastWord = words[words.length - 1];
    const repeats = words.filter((w) => w === lastWord).length;
    if (repeats > 15) return true;
  }
  return false;
}

function assessQuality(text, finishReason, looping) {
  if (looping) return 'BAD-LOOP';
  if (finishReason === 'length') return 'TRUNCATED';
  if (finishReason === 'timeout') return 'TIMEOUT';
  if (!text || text.length < 10) return 'EMPTY';
  return 'OK';
}

async function runBenchmark() {
  console.log('=== KYNS Live Benchmark ===\n');
  console.log('Logging in...');
  const token = await login();
  console.log('Authenticated.\n');

  const results = [];

  // Normal tests
  console.log('--- KYNS Normal (10 prompts) ---\n');
  for (let i = 0; i < NORMAL_PROMPTS.length; i++) {
    const prompt = NORMAL_PROMPTS[i];
    const label = `Normal #${i + 1}`;
    process.stdout.write(`${label}: "${prompt.slice(0, 50)}..." `);
    try {
      const r = await sendChat(token, prompt, 'kyns');
      const looping = detectLooping(r.text);
      const quality = assessQuality(r.text, r.finishReason, looping);
      const textLen = (r.text || '').length;
      console.log(`${quality} | ${(r.totalMs / 1000).toFixed(1)}s | TTFT:${r.ttft != null ? (r.ttft / 1000).toFixed(1) + 's' : '?'} | finish:${r.finishReason} | ${textLen}ch`);
      results.push({ label, prompt, spec: 'kyns', ...r, looping, quality, textLen });
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({ label, prompt, spec: 'kyns', error: err.message });
    }
  }

  // Deep tests
  console.log('\n--- KYNS Deep (10 prompts) ---\n');
  for (let i = 0; i < DEEP_PROMPTS.length; i++) {
    const prompt = DEEP_PROMPTS[i];
    const label = `Deep #${i + 1}`;
    process.stdout.write(`${label}: "${prompt.slice(0, 50)}..." `);
    try {
      const r = await sendChat(token, prompt, 'kyns-deep');
      const looping = detectLooping(r.text);
      const quality = assessQuality(r.text, r.finishReason, looping);
      const textLen = (r.text || '').length;
      console.log(`${quality} | ${(r.totalMs / 1000).toFixed(1)}s | TTFT:${r.ttft != null ? (r.ttft / 1000).toFixed(1) + 's' : '?'} | finish:${r.finishReason} | ${textLen}ch`);
      results.push({ label, prompt, spec: 'kyns-deep', ...r, looping, quality, textLen });
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({ label, prompt, spec: 'kyns-deep', error: err.message });
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===\n');
  const normalResults = results.filter((r) => r.spec === 'kyns' && !r.error);
  const deepResults = results.filter((r) => r.spec === 'kyns-deep' && !r.error);

  const normalOk = normalResults.filter((r) => r.quality === 'OK').length;
  const deepOk = deepResults.filter((r) => r.quality === 'OK').length;
  const normalLoops = normalResults.filter((r) => r.looping).length;
  const deepLoops = deepResults.filter((r) => r.looping).length;
  const normalTrunc = normalResults.filter((r) => r.finishReason === 'length').length;
  const deepTrunc = deepResults.filter((r) => r.finishReason === 'length').length;
  const normalTimeout = normalResults.filter((r) => r.finishReason === 'timeout').length;
  const deepTimeout = deepResults.filter((r) => r.finishReason === 'timeout').length;

  const avgNormal = normalResults.length > 0
    ? (normalResults.reduce((s, r) => s + r.totalMs, 0) / normalResults.length / 1000).toFixed(1)
    : '?';
  const avgDeep = deepResults.length > 0
    ? (deepResults.reduce((s, r) => s + r.totalMs, 0) / deepResults.length / 1000).toFixed(1)
    : '?';

  console.log(`Normal: ${normalOk}/${normalResults.length} OK | ${normalLoops} loops | ${normalTrunc} truncated | ${normalTimeout} timeout | avg ${avgNormal}s`);
  console.log(`Deep:   ${deepOk}/${deepResults.length} OK | ${deepLoops} loops | ${deepTrunc} truncated | ${deepTimeout} timeout | avg ${avgDeep}s`);

  // Write detailed results
  const report = results.map((r) => ({
    label: r.label,
    prompt: r.prompt,
    quality: r.quality || 'ERROR',
    totalSec: r.totalMs ? (r.totalMs / 1000).toFixed(1) : '?',
    ttftSec: r.ttft != null ? (r.ttft / 1000).toFixed(1) : '?',
    finishReason: r.finishReason || '?',
    looping: r.looping || false,
    textLength: r.textLen || 0,
    textPreview: (r.text || '').slice(0, 200).replace(/\n/g, ' '),
    error: r.error || null,
  }));

  const fs = require('fs');
  const outPath = 'e2e/kyns-benchmark-live-results.json';
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed results: ${outPath}`);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
