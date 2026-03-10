const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const sharp = require('sharp');
const { logger } = require('@librechat/data-schemas');
const paths = require('~/config/paths');

const PROXY_API_KEY = process.env.IMAGE_PROXY_KEY || 'kyns-image-internal';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300_000;
const WATERMARK_TEXT = 'kyns.ai';

const router = express.Router();

const getRunpodKey = () => process.env.RUNPOD_IMAGE_API_KEY || process.env.RUNPOD_API_KEY || '';
const getEndpointId = () => process.env.RUNPOD_IMAGE_ENDPOINT_ID || '';

function ensureGeneratedDir() {
  const dir = path.join(paths.imageOutput, 'generated');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

async function addWatermark(buffer) {
  const meta = await sharp(buffer).metadata();
  const w = meta.width || 1024;
  const h = meta.height || 1024;
  const fontSize = Math.max(16, Math.floor(w / 45));
  const margin = 14;
  const textW = Math.ceil(WATERMARK_TEXT.length * fontSize * 0.58);
  const x = w - textW - margin;
  const y = h - margin;

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x + 1}" y="${y + 1}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(0,0,0,0.45)">${WATERMARK_TEXT}</text>
    <text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(255,255,255,0.65)">${WATERMARK_TEXT}</text>
  </svg>`;

  return sharp(buffer).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}

async function pollRunpodJob(endpointId, jobId, apiKey) {
  const statusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${jobId}`;
  const cancelUrl = `https://api.runpod.ai/v2/${endpointId}/cancel/${jobId}`;
  const start = Date.now();
  let inQueueCount = 0;
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const resp = await axios.get(statusUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    const { status, output, error } = resp.data;
    if (status === 'COMPLETED') return output;
    if (status === 'FAILED' || error) throw new Error(`RunPod job failed: ${error || 'unknown'}`);
    if (status === 'CANCELLED') throw new Error('Geração cancelada.');
    if (status === 'IN_QUEUE') {
      inQueueCount++;
      if (inQueueCount >= 10) {
        await axios.post(cancelUrl, {}, { headers: { Authorization: `Bearer ${apiKey}` } }).catch(() => {});
        throw new Error('Sem GPU disponível agora. O servidor de imagem está offline ou sobrecarregado. Tente novamente em alguns minutos.');
      }
    }
  }
  await axios.post(cancelUrl, {}, { headers: { Authorization: `Bearer ${apiKey}` } }).catch(() => {});
  throw new Error('Timeout: geração de imagem demorou mais de 5 minutos.');
}

function parseImageRequest(messages, requestedModel) {
  const lastUser = [...(messages || [])].reverse().find((m) => m.role === 'user');
  const content = typeof lastUser?.content === 'string' ? lastUser.content : '';
  const isPortrait = /portrait|vertical|tall/i.test(content);
  const isLandscape = /landscape|horizontal|wide/i.test(content);

  // requestedModel from the model spec takes precedence; fall back to keyword detection
  const validModels = new Set(['lustify', 'zimage']);
  const model = validModels.has(requestedModel) ? requestedModel
    : /zimage|fast|rápido|rapido|quick/i.test(content) ? 'zimage'
    : 'lustify';

  const width = Math.round((isLandscape ? 1792 : 1024) / 8) * 8;
  const height = Math.round((isPortrait ? 1792 : 1024) / 8) * 8;

  return {
    prompt: content,
    model,
    width,
    height,
    steps: model === 'zimage' ? 8 : 30,
    cfg_scale: 7,
    negative_prompt: 'lowres, blurry, bad anatomy, worst quality, low quality',
  };
}

function makeResponse(content) {
  return {
    id: `chatcmpl-${uuidv4()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'kyns-image',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

async function imageRequestHandler(req, res) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.includes(PROXY_API_KEY)) {
    return res.status(401).json({ error: { message: 'Unauthorized', type: 'auth_error' } });
  }

  const apiKey = getRunpodKey();
  const endpointId = getEndpointId();

  if (!apiKey || !endpointId) {
    logger.error('[imageProxy] Missing RunPod credentials');
    return res.json(makeResponse('Geração de imagens não configurada. Contate o administrador.'));
  }

  const params = parseImageRequest(req.body.messages, req.body.model);

  if (!params.prompt || params.prompt.trim().length < 3) {
    return res.json(makeResponse('Por favor, descreva a imagem que deseja gerar.'));
  }

  let jobId;
  try {
    const runResp = await axios.post(
      `https://api.runpod.ai/v2/${endpointId}/run`,
      { input: params },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
    );
    jobId = runResp.data.id;
    logger.info(`[imageProxy] RunPod job submitted: ${jobId}`);
  } catch (err) {
    logger.error('[imageProxy] Failed to submit RunPod job:', err?.response?.data ?? err.message);
    return res.json(makeResponse('Erro ao enviar requisição de imagem. Tente novamente.'));
  }

  let output;
  try {
    output = await pollRunpodJob(endpointId, jobId, apiKey);
  } catch (err) {
    logger.error('[imageProxy] RunPod polling failed:', err.message);
    return res.json(makeResponse(`Erro ao gerar imagem: ${err.message}`));
  }

  const base64 = output?.image;
  if (!base64) {
    logger.error('[imageProxy] No image in RunPod output:', output);
    return res.json(makeResponse('O servidor não retornou a imagem. Tente novamente.'));
  }

  const fileId = uuidv4();
  const filename = `${fileId}.png`;

  try {
    const generatedDir = ensureGeneratedDir();
    let imageBuffer = Buffer.from(base64, 'base64');
    imageBuffer = await addWatermark(imageBuffer);
    fs.writeFileSync(path.join(generatedDir, filename), imageBuffer);
    logger.info(`[imageProxy] Image saved: generated/${filename}`);
  } catch (err) {
    logger.error('[imageProxy] Failed to save image:', err.message);
    return res.json(makeResponse(`Imagem gerada mas erro ao salvar: ${err.message}`));
  }

  const serverDomain = process.env.DOMAIN_SERVER || 'http://localhost:3080';
  const imageUrl = `${serverDomain}/images/generated/${filename}`;
  const modelLabel = params.model === 'lustify' ? 'Lustify v7' : 'Z-Image Turbo';
  const content = `![Imagem gerada](${imageUrl})\n\n_Gerada por KYNS Image · ${modelLabel} · ${params.width}×${params.height}px_`;

  return res.json(makeResponse(content));
}

router.post('/chat/completions', imageRequestHandler);
router.post('/v1/chat/completions', imageRequestHandler);

module.exports = router;
