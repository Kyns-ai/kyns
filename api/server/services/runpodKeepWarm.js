/**
 * Keep RunPod workers warm by sending a lightweight ping every 5 minutes.
 * Only active during Brazilian peak hours (07:00–23:00 BRT = 10:00–02:00 UTC).
 * Without this, cold starts take 3–5 minutes.
 */
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const PING_TIMEOUT_MS = 30_000;
// BRT = UTC-3. Peak hours: 07:00–23:00 BRT → 10:00–02:00 UTC (next day)
const PEAK_START_UTC = 10; // 07:00 BRT
const PEAK_END_UTC = 2;    // 23:00 BRT (wraps past midnight)

function isRunpodServerless(baseURL) {
  return typeof baseURL === 'string' && baseURL.includes('api.runpod.ai/v2/');
}

function extractEndpointId(baseURL) {
  const match = baseURL.match(/api\.runpod\.ai\/v2\/([^/]+)/);
  return match ? match[1] : null;
}

function isBrazilianPeakHour() {
  const hourUtc = new Date().getUTCHours();
  // Peak: 10:00–23:59 UTC (07:00–20:59 BRT) AND 00:00–02:00 UTC (21:00–23:00 BRT)
  return hourUtc >= PEAK_START_UTC || hourUtc < PEAK_END_UTC;
}

async function pingRunpod(endpointId, apiKey) {
  const url = `https://api.runpod.ai/v2/${endpointId}/runsync`;
  const body = {
    input: {
      openai_route: '/v1/chat/completions',
      openai_input: {
        model: process.env.RUNPOD_MODEL || 'llmfan46/Qwen3.5-27B-heretic-v2',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      },
    },
  };

  const response = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: PING_TIMEOUT_MS,
  });

  const exec = response.data?.executionTime ?? '?';
  const delay = response.data?.delayTime ?? '?';
  logger.info(`[RunpodKeepWarm] ping ok — delay: ${delay}ms, exec: ${exec}ms`);
}

function startKeepWarm() {
  const baseURL = process.env.OPENAI_REVERSE_PROXY;
  const apiKey = process.env.RUNPOD_API_KEY || process.env.OPENAI_API_KEY;

  if (!baseURL || !isRunpodServerless(baseURL)) {
    return;
  }

  const endpointId = extractEndpointId(baseURL);
  if (!endpointId || !apiKey) {
    return;
  }

  logger.info(`[RunpodKeepWarm] Starting keep-warm pings every ${PING_INTERVAL_MS / 60000} min for endpoint ${endpointId} (BR peak hours only: 07–23h BRT)`);

  const run = () => {
    if (!isBrazilianPeakHour()) {
      logger.debug('[RunpodKeepWarm] Outside BR peak hours, skipping ping');
      return;
    }
    pingRunpod(endpointId, apiKey).catch((err) => {
      logger.warn(`[RunpodKeepWarm] ping failed: ${err.message}`);
    });
  };

  run();
  setInterval(run, PING_INTERVAL_MS);
}

module.exports = { startKeepWarm };
