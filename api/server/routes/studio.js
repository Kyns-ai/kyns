const axios = require('axios');
const rateLimit = require('express-rate-limit');
const express = require('express');
const sharp = require('sharp');
const { limiterCache } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');

const MINOR_PROMPT_PATTERNS = [
  /\b(child|children|kid|kids|minor|minors|underage|juvenile|infant|toddler|baby)\b/i,
  /\b(loli|shota|lolita|shotacon)\b/i,
  /\b(little (girl|boy|kid)|young (girl|boy|teen|child))\b/i,
  /\b(school(girl|boy)|schoolchild|schoolkid)\b/i,
  /\b(preteen|pre-teen|tween|pubescent|prepubescent)\b/i,
  /\b(menina|menino|criança|crianças|menor|infante|bebê|bebe)\b/i,
  /\b\d{1,2}\s*(years?\s*old|anos?\s*(de\s*idade)?|yr\.?\s*old)\b/i,
  /\b(novinh[ao]s?|pirralh\w+|moleque|molecada)\b/i,
  /\b(barely\s+(legal|adult)|just\s+turned\s+18)\b/i,
  /\b(appears?\s+(young|younger)|looks?\s+(young|like\s+a\s+(child|minor|kid)))\b/i,
];

const IMAGE_NEGATIVE_PROMPT =
  'child, children, minor, underage, infant, toddler, baby face, juvenile, teen, teenager, ' +
  'loli, shota, lolita, school uniform on young person, pubescent, prepubescent, ' +
  'young face, childlike features, petite child, little girl, little boy';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 420_000;
const NO_WORKER_CANCEL_MS = 300_000;
const STUDIO_DAILY_LIMIT = 20;
const STUDIO_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const RUNPOD_SUBMIT_TIMEOUT_MS = 30_000;
const RUNPOD_POLL_REQUEST_TIMEOUT_MS = 20_000;
const WATERMARK_TEXT = 'kyns.ai';

const router = express.Router();

const getRunpodKey = () => process.env.RUNPOD_IMAGE_API_KEY || process.env.RUNPOD_API_KEY || '';
const getEndpointId = () => process.env.RUNPOD_IMAGE_ENDPOINT_ID || '';

async function addWatermark(buffer) {
  const meta = await sharp(buffer).metadata();
  const w = meta.width || 1024;
  const h = meta.height || 1024;
  const fontSize = Math.max(18, Math.floor(w / 34));
  const margin = Math.max(16, Math.floor(w / 64));
  const x = w - margin;
  const y = h - margin;
  const fontFamily = 'DejaVu Sans, sans-serif';

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x + 1}" y="${y + 1}" text-anchor="end" font-family="${fontFamily}" font-size="${fontSize}" font-weight="600" fill="rgba(0,0,0,0.42)">${WATERMARK_TEXT}</text>
    <text x="${x}" y="${y}" text-anchor="end" font-family="${fontFamily}" font-size="${fontSize}" font-weight="600" fill="rgba(255,255,255,0.82)">${WATERMARK_TEXT}</text>
  </svg>`;

  return sharp(buffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function pollRunpodJob(endpointId, jobId, apiKey) {
  const healthUrl = `https://api.runpod.ai/v2/${endpointId}/health`;
  const statusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${jobId}`;
  const cancelUrl = `https://api.runpod.ai/v2/${endpointId}/cancel/${jobId}`;
  const start = Date.now();
  let firstWorkerSeen = false;
  const pollAxiosConfig = {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: RUNPOD_POLL_REQUEST_TIMEOUT_MS,
  };

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const resp = await axios.get(statusUrl, pollAxiosConfig);
    const { status, output, error } = resp.data;
    if (status === 'COMPLETED') {
      return output;
    }
    if (status === 'FAILED' || error) {
      throw new Error(`RunPod job failed: ${output?.error || error || 'unknown'}`);
    }
    if (status === 'CANCELLED') {
      throw new Error('Geração cancelada.');
    }
    if (!firstWorkerSeen && status === 'IN_PROGRESS') {
      firstWorkerSeen = true;
    }
    if (!firstWorkerSeen && Date.now() - start > NO_WORKER_CANCEL_MS) {
      const health = await axios
        .get(healthUrl, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: RUNPOD_POLL_REQUEST_TIMEOUT_MS })
        .catch(() => ({ data: { workers: {} } }));
      const w = health.data?.workers ?? {};
      const hasWorkers = (w.idle ?? 0) + (w.initializing ?? 0) + (w.ready ?? 0) + (w.running ?? 0) > 0;
      if (!hasWorkers) {
        await axios.post(cancelUrl, {}, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10_000 }).catch(() => {});
        throw new Error('Sem GPU disponível agora. Tente novamente em 1-2 minutos.');
      }
    }
  }
  await axios.post(cancelUrl, {}, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10_000 }).catch(() => {});
  throw new Error('Timeout: geração demorou mais de 7 minutos.');
}

const studioLimiter = rateLimit({
  windowMs: STUDIO_DAILY_WINDOW_MS,
  max: STUDIO_DAILY_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: (req) => String(req.user?.id ?? 'anonymous'),
  requestWasSuccessful: (_req, res) => res.locals.studioSuccess === true,
  store: limiterCache('studio_image_limiter'),
  handler: (_req, res) =>
    res.status(429).json({ error: `Limite de ${STUDIO_DAILY_LIMIT} imagens por dia atingido.` }),
});

router.post('/generate', requireJwtAuth, studioLimiter, async (req, res) => {
  try {
    const apiKey = getRunpodKey();
    const endpointId = getEndpointId();

    if (!apiKey || !endpointId) {
      return res.status(503).json({ error: 'Geração de imagens não configurada.' });
    }

    const { prompt, model: requestedModel } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return res.status(400).json({ error: 'Descreva a imagem que deseja gerar.' });
    }

    if (MINOR_PROMPT_PATTERNS.some((p) => p.test(prompt))) {
      return res.status(400).json({ error: 'Essa solicitação não pode ser processada.' });
    }

    const validModels = new Set(['flux2klein', 'zimage']);
    const model = validModels.has(requestedModel) ? requestedModel : 'flux2klein';
    const isPortrait = /portrait|vertical|tall/i.test(prompt);
    const isLandscape = /landscape|horizontal|wide/i.test(prompt);
    const width = Math.round((isLandscape ? 1792 : 1024) / 8) * 8;
    const height = Math.round((isPortrait ? 1792 : 1024) / 8) * 8;
    const isZimage = model === 'zimage';

    const input = {
      prompt: prompt.trim(),
      model,
      width,
      height,
      steps: isZimage ? 9 : 4,
      cfg_scale: isZimage ? 0.0 : 3.5,
      negative_prompt: IMAGE_NEGATIVE_PROMPT,
    };

    const runResp = await axios.post(
      `https://api.runpod.ai/v2/${endpointId}/run`,
      { input },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: RUNPOD_SUBMIT_TIMEOUT_MS,
      },
    );
    const jobId = runResp.data.id;
    logger.info(`[studio] RunPod job submitted: ${jobId} by user ${req.user?.id}`);

    const output = await pollRunpodJob(endpointId, jobId, apiKey);
    const base64 = output?.image;

    if (!base64) {
      return res.status(502).json({ error: 'O servidor não retornou a imagem.' });
    }

    let imageBuffer = Buffer.from(base64, 'base64');
    imageBuffer = await addWatermark(imageBuffer);
    const watermarkedBase64 = imageBuffer.toString('base64');
    res.locals.studioSuccess = true;
    logger.info(`[studio] Image generated for user ${req.user?.id}`);

    return res.json({
      image: watermarkedBase64,
      model,
      width,
      height,
    });
  } catch (err) {
    logger.error('[studio] Generation error:', err.message);
    return res.status(500).json({ error: err.message || 'Erro inesperado.' });
  }
});

module.exports = router;
