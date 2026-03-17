const axios = require('axios');
const sharp = require('sharp');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { Tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');
const { ContentTypes, FileContext } = require('librechat-data-provider');
const { runpodCircuit } = require('~/server/utils/circuitBreaker');

const DAILY_LIMIT = 10;
const MAX_PROMPT_LENGTH = 2000;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;
const RUNPOD_SUBMIT_TIMEOUT_MS = 30_000;
const RUNPOD_POLL_REQUEST_TIMEOUT_MS = 15_000;
const RUNPOD_SUBMIT_RETRIES = 2;

const kynsImageSchema = {
  type: 'object',
  properties: {
    prompt: {
      type: 'string',
      description:
        'Detailed description of the image to generate. Be specific about subjects, style, lighting, mood, and composition. Minimum 10 words.',
    },
    negative_prompt: {
      type: 'string',
      description: 'What to exclude from the image (e.g. "blurry, low quality, bad anatomy").',
    },
    model: {
      type: 'string',
      enum: ['lustify', 'zimage'],
      description:
        '"lustify" for Lustify v7 (SDXL, photorealistic/NSFW, 30 steps). "zimage" for Z-Image Turbo (DiT, fast high-quality, 8 steps).',
    },
    width: {
      type: 'integer',
      description: 'Image width in pixels. Must be a multiple of 8. Default: 1024.',
    },
    height: {
      type: 'integer',
      description: 'Image height in pixels. Must be a multiple of 8. Default: 1024.',
    },
    steps: {
      type: 'integer',
      description: 'Inference steps (1-50). Default: 30.',
    },
    cfg_scale: {
      type: 'number',
      description: 'Guidance scale (1-15). Default: 7.',
    },
    seed: {
      type: 'integer',
      description: 'Optional seed for reproducibility.',
    },
  },
  required: ['prompt'],
};

const displayMessage =
  "KYNS Image generated an image. All generated images are already plainly visible — don't repeat the description. Do not list download links; the user can click the image to download.";

let _watermarkConfig = null;
let _watermarkLastCheck = 0;

async function getWatermarkConfig() {
  const now = Date.now();
  if (_watermarkConfig !== null && now - _watermarkLastCheck < 60_000) return _watermarkConfig;
  _watermarkLastCheck = now;
  try {
    const db = mongoose.connection?.db;
    if (db) {
      const doc = await db.collection('kyns_config').findOne({ key: 'watermark' });
      if (doc?.value) {
        _watermarkConfig = doc.value;
        return _watermarkConfig;
      }
    }
  } catch {
    // Fall through to defaults
  }
  _watermarkConfig = { enabled: true, text: 'kyns.ai', position: 'bottom-right', opacity: 0.5 };
  return _watermarkConfig;
}

async function addWatermark(buffer) {
  const config = await getWatermarkConfig();
  if (config.enabled === false) return buffer;

  const meta = await sharp(buffer).metadata();
  const w = meta.width || 1024;
  const h = meta.height || 1024;
  const fontSize = Math.max(16, Math.floor(w / 45));
  const margin = 14;
  const text = config.text || 'kyns.ai';
  const opacity = config.opacity ?? 0.65;
  const shadowOpacity = Math.max(0, opacity - 0.2);
  const textW = Math.ceil(text.length * fontSize * 0.58);
  const textH = fontSize;

  let x, y;
  switch (config.position || 'bottom-right') {
    case 'top-left':
      x = margin;
      y = textH + margin;
      break;
    case 'top-right':
      x = w - textW - margin;
      y = textH + margin;
      break;
    case 'bottom-left':
      x = margin;
      y = h - margin;
      break;
    case 'center':
      x = (w - textW) / 2;
      y = (h + textH) / 2;
      break;
    default:
      x = w - textW - margin;
      y = h - margin;
  }

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x + 1}" y="${y + 1}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(0,0,0,${shadowOpacity})">${text}</text>
    <text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(255,255,255,${opacity})">${text}</text>
  </svg>`;

  return sharp(buffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function countImagesGeneratedToday(userId) {
  try {
    const { File } = require('~/db/models');
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    return await File.countDocuments({
      user: userId,
      context: FileContext.image_generation,
      createdAt: { $gte: startOfDay },
    });
  } catch (err) {
    logger.error('[KynsImageGen] countImagesGeneratedToday error:', err.message);
    return 0;
  }
}

async function pollRunpodJob(endpointId, jobId, apiKey) {
  const statusUrl = `https://api.runpod.ai/v2/${endpointId}/status/${jobId}`;
  const start = Date.now();
  const axiosConfig = {
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: RUNPOD_POLL_REQUEST_TIMEOUT_MS,
  };
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const resp = await axios.get(statusUrl, axiosConfig);
    const { status, output, error } = resp.data;
    if (status === 'COMPLETED') {
      return output;
    }
    if (status === 'FAILED' || error) {
      throw new Error(`RunPod job failed: ${error || 'unknown error'}`);
    }
  }
  throw new Error('RunPod image generation timed out after 120 seconds.');
}

class KynsImageGen extends Tool {
  constructor(fields = {}) {
    super();
    this.override = fields.override ?? false;
    this.userId = fields.userId;
    this.fileStrategy = fields.fileStrategy;
    this.returnMetadata = fields.returnMetadata ?? false;
    this.isAgent = fields.isAgent;

    if (fields.uploadImageBuffer) {
      this.uploadImageBuffer = fields.uploadImageBuffer.bind(this);
    }

    this.apiKey =
      fields.RUNPOD_IMAGE_API_KEY ||
      process.env.RUNPOD_IMAGE_API_KEY ||
      process.env.RUNPOD_API_KEY ||
      '';

    this.endpointId = fields.RUNPOD_IMAGE_ENDPOINT_ID || process.env.RUNPOD_IMAGE_ENDPOINT_ID || '';

    if (!this.apiKey && !this.override) {
      throw new Error('Missing RUNPOD_IMAGE_API_KEY environment variable.');
    }
    if (!this.endpointId && !this.override) {
      throw new Error('Missing RUNPOD_IMAGE_ENDPOINT_ID environment variable.');
    }

    this.name = 'kyns-image-gen';
    this.description =
      'Generate images from text descriptions. Models: "lustify" (photorealistic) or "zimage" (fast). Each call generates one image.';
    this.description_for_model = `// Generate high-quality images from text descriptions.
// Rules:
// - ALWAYS write detailed prompts (10+ words about subject, style, lighting, composition, mood).
// - Default model is "lustify" unless user wants fast generation (then use "zimage").
// - Use "zimage" for faster or non-NSFW generation; use "lustify" for photorealistic/NSFW.
// - Default size 1024x1024. Use 1024x1792 for portraits, 1792x1024 for landscapes.
// - ALWAYS show the image in your response using the markdown that is returned.
// - Users have a limit of ${DAILY_LIMIT} images per day.`;

    this.schema = kynsImageSchema;
  }

  static get jsonSchema() {
    return kynsImageSchema;
  }

  wrapInMarkdown(filepath) {
    const serverDomain = process.env.DOMAIN_SERVER || 'http://localhost:3080';
    return `![generated image](${serverDomain}${filepath})`;
  }

  createAgentToolResult(imageBuffer, fileId) {
    const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    const textResponse = [
      {
        type: ContentTypes.TEXT,
        text: `${displayMessage}\n\ngenerated_image_id: "${fileId}"`,
      },
    ];

    return [
      textResponse,
      {
        content: [
          {
            type: ContentTypes.IMAGE_URL,
            image_url: { url: dataUrl },
          },
        ],
        file_ids: [fileId],
      },
    ];
  }

  async _call(data) {
    const {
      prompt,
      negative_prompt = 'lowres, blurry, bad anatomy, worst quality, low quality, watermark',
      model = 'lustify',
      width = 1024,
      height = 1024,
      steps = 30,
      cfg_scale = 7,
      seed,
    } = data;

    if (!prompt || prompt.trim().length < 3) {
      return 'Please provide a more detailed prompt.';
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return `O prompt deve ter no máximo ${MAX_PROMPT_LENGTH} caracteres. Atual: ${prompt.length}.`;
    }

    if (runpodCircuit.isOpen()) {
      return 'O servidor de imagens está temporariamente indisponível. Tente novamente em 1 minuto.';
    }

    const count = await countImagesGeneratedToday(this.userId);
    if (count >= DAILY_LIMIT) {
      return `Você atingiu o limite de ${DAILY_LIMIT} imagens por dia. O limite reinicia à meia-noite (UTC).`;
    }

    const jobInput = {
      prompt: prompt.trim(),
      negative_prompt,
      model,
      width: Math.round(width / 8) * 8,
      height: Math.round(height / 8) * 8,
      steps: Math.min(50, Math.max(1, steps)),
      cfg_scale,
      ...(seed !== undefined ? { seed } : {}),
    };

    let jobId;
    let lastErr;
    for (let attempt = 1; attempt <= RUNPOD_SUBMIT_RETRIES; attempt++) {
      try {
        const runResp = await axios.post(
          `https://api.runpod.ai/v2/${this.endpointId}/run`,
          { input: jobInput },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: RUNPOD_SUBMIT_TIMEOUT_MS,
          },
        );
        jobId = runResp.data.id;
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        logger.error(
          `[KynsImageGen] RunPod submit attempt ${attempt}/${RUNPOD_SUBMIT_RETRIES}:`,
          err?.code ?? err?.message,
          err?.response?.data ?? '',
        );
        if (attempt < RUNPOD_SUBMIT_RETRIES) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
    if (lastErr) {
      runpodCircuit.recordFailure();
    }
    if (lastErr || !jobId) {
      const msg = lastErr?.message ?? 'Unknown error';
      const isTimeout = /timeout|ETIMEDOUT|ECONNABORTED/i.test(msg);
      const isConn = /ECONNREFUSED|ECONNRESET|Connection error|terminated|fetch failed/i.test(msg);
      if (isTimeout) {
        return 'O servidor de imagens demorou para responder. Tente novamente em alguns instantes.';
      }
      if (isConn) {
        return 'Falha de conexão com o servidor de imagens. Verifique se o endpoint RunPod está ativo e tente novamente.';
      }
      return 'Erro ao enviar requisição de imagem. Tente novamente.';
    }

    let output;
    try {
      output = await pollRunpodJob(this.endpointId, jobId, this.apiKey);
      runpodCircuit.recordSuccess();
    } catch (err) {
      runpodCircuit.recordFailure();
      const msg = err?.message ?? '';
      logger.error('[KynsImageGen] RunPod polling failed:', msg);
      if (/timeout|timed out|ETIMEDOUT/i.test(msg)) {
        return 'A geração da imagem demorou mais que o limite. Tente novamente ou use o modelo Turbo para respostas mais rápidas.';
      }
      if (/ECONNREFUSED|ECONNRESET|Connection error|fetch failed/i.test(msg)) {
        return 'Falha de conexão com o servidor de imagens. Tente novamente em alguns instantes.';
      }
      return `Erro ao gerar imagem: ${msg}`;
    }

    const base64 = output?.image;
    if (!base64) {
      logger.error('[KynsImageGen] No image in RunPod output:', output);
      return 'O worker não retornou imagem. Tente novamente.';
    }

    const file_id = uuidv4();
    const imageName = `${file_id}.png`;

    try {
      let imageBuffer = Buffer.from(base64, 'base64');
      imageBuffer = await addWatermark(imageBuffer);

      if (this.returnMetadata) {
        return this.createAgentToolResult(imageBuffer, file_id);
      }

      const file = await this.uploadImageBuffer({
        req: { user: { id: this.userId } },
        context: FileContext.image_generation,
        resize: false,
        metadata: {
          buffer: imageBuffer,
          height,
          width,
          bytes: imageBuffer.length,
          filename: imageName,
          type: 'image/png',
          file_id,
        },
      });

      return `${displayMessage}\n\n${this.wrapInMarkdown(file.filepath)}`;
    } catch (err) {
      logger.error('[KynsImageGen] Failed to save image:', err.message);
      return `Imagem gerada mas falha ao salvar: ${err.message}`;
    }
  }
}

module.exports = KynsImageGen;
