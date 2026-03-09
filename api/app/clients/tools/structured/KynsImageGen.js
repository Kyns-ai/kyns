const axios = require('axios');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { Tool } = require('@langchain/core/tools');
const { logger } = require('@librechat/data-schemas');
const { FileContext } = require('librechat-data-provider');

const DAILY_LIMIT = 10;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

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
      description: '"lustify" for Lustify v7 (SDXL, photorealistic/NSFW, 30 steps). "zimage" for Z-Image Turbo (DiT, fast high-quality, 8 steps).',
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

async function addWatermark(buffer) {
  const meta = await sharp(buffer).metadata();
  const w = meta.width || 1024;
  const h = meta.height || 1024;
  const fontSize = Math.max(16, Math.floor(w / 45));
  const margin = 14;
  const text = 'kyns.ai';
  const textW = Math.ceil(text.length * fontSize * 0.58);
  const x = w - textW - margin;
  const y = h - margin;

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x + 1}" y="${y + 1}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(0,0,0,0.45)">${text}</text>
    <text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="rgba(255,255,255,0.65)">${text}</text>
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
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const resp = await axios.get(statusUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
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

    this.endpointId =
      fields.RUNPOD_IMAGE_ENDPOINT_ID || process.env.RUNPOD_IMAGE_ENDPOINT_ID || '';

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
    try {
      const runResp = await axios.post(
        `https://api.runpod.ai/v2/${this.endpointId}/run`,
        { input: jobInput },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      jobId = runResp.data.id;
    } catch (err) {
      logger.error(
        '[KynsImageGen] Failed to submit RunPod job:',
        err?.response?.data ?? err.message,
      );
      return 'Erro ao enviar requisição de imagem. Tente novamente.';
    }

    let output;
    try {
      output = await pollRunpodJob(this.endpointId, jobId, this.apiKey);
    } catch (err) {
      logger.error('[KynsImageGen] RunPod polling failed:', err.message);
      return `Erro ao gerar imagem: ${err.message}`;
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

      if (this.returnMetadata) {
        return file;
      }

      return `${displayMessage}\n\n${this.wrapInMarkdown(file.filepath)}`;
    } catch (err) {
      logger.error('[KynsImageGen] Failed to save image:', err.message);
      return `Imagem gerada mas falha ao salvar: ${err.message}`;
    }
  }
}

module.exports = KynsImageGen;
