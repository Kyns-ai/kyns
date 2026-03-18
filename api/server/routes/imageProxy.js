const fs = require('fs');
const path = require('path');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { limiterCache } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const paths = require('~/config/paths');

const MINOR_PROMPT_PATTERNS = [
  /\b(child|children|kid|kids|minor|minors|underage|juvenile|infant|toddler|baby)\b/i,
  /\b(loli|shota|lolita|shotacon)\b/i,
  /\b(little (girl|boy|kid)|young (girl|boy|teen|child))\b/i,
  /\b(school(girl|boy)|schoolchild|schoolkid)\b/i,
  /\b(preteen|pre-teen|tween|pubescent|prepubescent)\b/i,
  /\b(menina|menino|criança|crianças|menor|infante|bebê|bebe)\b/i,
  /\b(colegiala|adolescente\s+(de\s+)?\d{1,2})\b/i,
  /\b\d{1,2}\s*(years?\s*old|anos?\s*(de\s*idade)?|yr\.?\s*old)\b/i,
  /\b(novinh[ao]s?|pirralh\w+|moleque|molecada)\b/i,
  /\b(ensino\s+(fundamental|medio|médio)|colegial|primario|primário)\b/i,
  /\b(middle\s+school|high\s+school\s+girl|high\s+school\s+student)\b/i,
  /\b(appears?\s+(young|younger)|looks?\s+(young|like\s+a\s+(child|minor|kid)))\b/i,
  /\b(barely\s+(legal|adult)|just\s+turned\s+18)\b/i,
  /\bage\s*[:=]\s*(?:[0-9]|1[0-7])\b/i,
  /\b(flat\s+chest(ed)?|no\s+curves?|undeveloped)\b.{0,40}\b(girl|woman|female)\b/i,
];

const IMAGE_NEGATIVE_PROMPT =
  'child, children, minor, underage, infant, toddler, baby face, juvenile, teen, teenager, ' +
  'loli, shota, lolita, school uniform on young person, pubescent, prepubescent, ' +
  'young face, childlike features, petite child, little girl, little boy';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 420_000;
const NO_WORKER_CANCEL_MS = 300_000;
const IMAGE_DAILY_LIMIT = 10;
const IMAGE_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const RUNPOD_SUBMIT_TIMEOUT_MS = 30_000;
const RUNPOD_POLL_REQUEST_TIMEOUT_MS = 20_000;
const WATERMARK_TEXT = 'kyns.ai';
const PROXY_AUTH_SCHEME = 'Bearer';
const IMAGE_PROXY_USER_TOKEN_AUDIENCE = 'image-proxy-user';

const router = express.Router();

const getRunpodKey = () => process.env.RUNPOD_IMAGE_API_KEY || process.env.RUNPOD_API_KEY || '';
const getEndpointId = () => process.env.RUNPOD_IMAGE_ENDPOINT_ID || '';
const getProxyApiKey = () => process.env.IMAGE_PROXY_KEY?.trim() || '';

function getHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return typeof value === 'string' ? value : '';
}

function getExpectedAuthHeader() {
  const proxyApiKey = getProxyApiKey();
  return proxyApiKey ? `${PROXY_AUTH_SCHEME} ${proxyApiKey}` : '';
}

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

function getRequesterUserId(req) {
  if (req.imageProxyUserId) {
    return req.imageProxyUserId;
  }
  if (typeof req.body?.userId === 'string' && req.body.userId.length > 0) {
    return req.body.userId;
  }
  return req.user?.id ?? req.body?.userId ?? null;
}

function getSignedRequesterUserId(req) {
  const signedUserToken = getHeaderValue(req.headers['x-kyns-user-token']);
  if (!signedUserToken) {
    return undefined;
  }

  try {
    const payload = jwt.verify(signedUserToken, getProxyApiKey(), {
      algorithms: ['HS256'],
      audience: IMAGE_PROXY_USER_TOKEN_AUDIENCE,
    });
    return typeof payload?.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch (error) {
    logger.warn('[imageProxy] Invalid signed user token');
    return null;
  }
}

function logRunpodError(jobId, output) {
  try {
    const db = mongoose.connection?.db;
    if (!db || !output) {
      return;
    }
    db.collection('kyns_error_logs').insertOne({
      source: 'runpod',
      level: 'error',
      message: String(output.error || 'RunPod job failed').slice(0, 1000),
      errorType: output.error_type || null,
      stack: typeof output.traceback === 'string' ? output.traceback.slice(0, 3000) : null,
      metadata: {
        jobId,
        model: output.model || null,
        gpuMemory: output.gpu_memory || null,
        preloadErrors: output.preload_errors || null,
      },
      createdAt: new Date(),
    }).catch(() => {});
  } catch {
    // Silent
  }
}

function makeDailyLimitMessage() {
  return `Você atingiu o limite de ${IMAGE_DAILY_LIMIT} imagens por dia. O limite reinicia à meia-noite (UTC).`;
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
    if (status === 'COMPLETED') return output;
    if (status === 'FAILED' || error) {
      logRunpodError(jobId, output);
      throw new Error(`RunPod job failed: ${output?.error || error || 'unknown'}`);
    }
    if (status === 'CANCELLED') throw new Error('Geração cancelada.');

    if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
      if (status === 'IN_PROGRESS') firstWorkerSeen = true;
      const elapsed = Date.now() - start;
      if (!firstWorkerSeen && elapsed > NO_WORKER_CANCEL_MS) {
        const health = await axios
          .get(healthUrl, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: RUNPOD_POLL_REQUEST_TIMEOUT_MS })
          .catch(() => ({ data: { workers: {} } }));
        const w = health.data?.workers ?? {};
        const hasWorkers =
          (w.idle ?? 0) + (w.initializing ?? 0) + (w.ready ?? 0) + (w.running ?? 0) > 0;
        if (!hasWorkers) {
          await axios
            .post(cancelUrl, {}, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10_000 })
            .catch(() => {});
          throw new Error(
            'Sem GPU disponível agora. O servidor de imagem está aquecendo — tente novamente em 1-2 minutos.',
          );
        }
      }
    }
  }
  await axios
    .post(cancelUrl, {}, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10_000 })
    .catch(() => {});
  throw new Error('Timeout: geração de imagem demorou mais de 7 minutos.');
}

function parseImageRequest(messages, requestedModel) {
  const lastUser = [...(messages || [])]
    .filter(Boolean)
    .reverse()
    .find((m) => m.role === 'user');
  const content = typeof lastUser?.content === 'string' ? lastUser.content : '';
  const isPortrait = /portrait|vertical|tall/i.test(content);
  const isLandscape = /landscape|horizontal|wide/i.test(content);

  const validModels = new Set(['flux2klein', 'zimage']);
  let model = 'flux2klein';
  if (validModels.has(requestedModel)) {
    model = requestedModel;
  } else if (/zimage|fast|rápido|rapido|quick|turbo/i.test(content)) {
    model = 'zimage';
  }

  const width = Math.round((isLandscape ? 1792 : 1024) / 8) * 8;
  const height = Math.round((isPortrait ? 1792 : 1024) / 8) * 8;

  const isZimage = model === 'zimage';
  return {
    prompt: content,
    model,
    width,
    height,
    steps: isZimage ? 9 : 4,
    cfg_scale: isZimage ? 0.0 : 3.5,
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

const imageGenerationLimiter = rateLimit({
  windowMs: IMAGE_DAILY_WINDOW_MS,
  max: IMAGE_DAILY_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: (req) => String(getRequesterUserId(req) ?? req.ip),
  requestWasSuccessful: (_req, res) => res.locals.imageGenerationCountable === true,
  store: limiterCache('image_generation_user_limiter'),
  handler: (_req, res) => res.status(200).json(makeResponse(makeDailyLimitMessage())),
});

function authenticateImageProxyRequest(req, res, next) {
  const expectedAuthHeader = getExpectedAuthHeader();
  if (!expectedAuthHeader) {
    logger.error('[imageProxy] IMAGE_PROXY_KEY is required');
    return res.status(503).json({
      error: { message: 'Image proxy is not configured', type: 'config_error' },
    });
  }

  const authHeader = getHeaderValue(req.headers.authorization);
  if (authHeader !== expectedAuthHeader) {
    return res.status(401).json({ error: { message: 'Unauthorized', type: 'auth_error' } });
  }

  const signedRequesterUserId = getSignedRequesterUserId(req);
  if (signedRequesterUserId === null) {
    return res.status(401).json({ error: { message: 'Unauthorized', type: 'auth_error' } });
  }

  if (signedRequesterUserId) {
    req.imageProxyUserId = signedRequesterUserId;
  }

  next();
}

async function imageRequestHandler(req, res) {
  try {
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

    if (MINOR_PROMPT_PATTERNS.some((pattern) => pattern.test(params.prompt))) {
      logger.warn('[imageProxy] Blocked prompt containing minor-related content');
      return res.json(makeResponse('Essa conversa não pode continuar nessa direção.'));
    }

    const inputWithNegative = { ...params, negative_prompt: IMAGE_NEGATIVE_PROMPT };

    let jobId;
    try {
      const runResp = await axios.post(
        `https://api.runpod.ai/v2/${endpointId}/run`,
        { input: inputWithNegative },
        {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: RUNPOD_SUBMIT_TIMEOUT_MS,
        },
      );
      jobId = runResp.data.id;
      logger.info(`[imageProxy] RunPod job submitted: ${jobId}`);
    } catch (err) {
      const msg = err?.message ?? '';
      logger.error('[imageProxy] Failed to submit RunPod job:', err?.response?.data ?? msg);
      if (/timeout|ETIMEDOUT|ECONNABORTED/i.test(msg)) {
        return res.json(makeResponse('O servidor de imagens demorou para responder. Tente novamente.'));
      }
      if (/ECONNREFUSED|ECONNRESET|Connection error/i.test(msg)) {
        return res.json(makeResponse('Falha de conexão com o servidor de imagens. Tente novamente em alguns instantes.'));
      }
      return res.json(makeResponse('Erro ao enviar requisição de imagem. Tente novamente.'));
    }

    let output;
    try {
      output = await pollRunpodJob(endpointId, jobId, apiKey);
    } catch (err) {
      logger.error('[imageProxy] RunPod polling failed:', err.message);
      const isModelMissing =
        err.message.includes('No image model available') || err.message.includes('model');
      const isNoGpu = err.message.includes('Sem GPU') || err.message.includes('cancelada');

      let userMsg = `Erro ao gerar imagem: ${err.message}`;
      if (isModelMissing) {
        userMsg = 'O servidor de imagem está reiniciando. Aguarde 2-3 minutos e tente novamente.';
      } else if (isNoGpu) {
        userMsg = err.message;
      }

      return res.json(makeResponse(userMsg));
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
      res.locals.imageGenerationCountable = true;
      logger.info(`[imageProxy] Image saved: generated/${filename}`);
    } catch (err) {
      logger.error('[imageProxy] Failed to save image:', err.message);
      return res.json(makeResponse(`Imagem gerada mas erro ao salvar: ${err.message}`));
    }

    const serverDomain = process.env.DOMAIN_SERVER || 'http://localhost:3080';
    const imageUrl = `${serverDomain}/images/generated/${filename}`;
    const content = `![Imagem gerada](${imageUrl})\n\n_Gerada por KYNS Image · ${params.width}×${params.height}px_`;

    return res.json(makeResponse(content));
  } catch (err) {
    logger.error('[imageProxy] Unhandled error:', err.message);
    return res.json(makeResponse('Erro inesperado na geração de imagem. Tente novamente.'));
  }
}

router.post('/chat/completions', authenticateImageProxyRequest, imageGenerationLimiter, imageRequestHandler);
router.post('/v1/chat/completions', authenticateImageProxyRequest, imageGenerationLimiter, imageRequestHandler);

module.exports = router;
