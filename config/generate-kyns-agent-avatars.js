#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const { kynsAgentAvatarDefinitions } = require('./kynsAgentAvatarDefinitions');

function loadSharp() {
  try {
    return require('sharp');
  } catch (error) {
    return require('../api/node_modules/sharp');
  }
}

const sharp = loadSharp();

const ENDPOINT_ID = process.env.RUNPOD_IMAGE_ENDPOINT_ID;
if (!ENDPOINT_ID) { console.error('RUNPOD_IMAGE_ENDPOINT_ID env var is required'); process.exit(1); }
const API_KEY = process.env.RUNPOD_IMAGE_API_KEY || process.env.RUNPOD_API_KEY || '';
const OUTPUT_DIR = path.resolve(__dirname, 'kyns-agent-avatars');
const TARGET_SIZE = 512;
const MAX_BYTES = 200 * 1024;
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const REQUEST_PAUSE_MS = 1500;
const DEFAULT_STEPS = 28;
const DEFAULT_CFG_SCALE = 3.5;

function parseArgs(argv) {
  const options = {
    only: new Set(),
    priorityOnly: false,
  };

  for (const arg of argv) {
    if (arg === '--priority-only') {
      options.priorityOnly = true;
      continue;
    }

    if (arg.startsWith('--only=')) {
      arg
        .slice('--only='.length)
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
        .forEach((value) => options.only.add(value));
    }
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function selectDefinitions(options) {
  return kynsAgentAvatarDefinitions.filter((definition) => {
    if (options.priorityOnly && !definition.priority) {
      return false;
    }

    if (options.only.size > 0) {
      return options.only.has(definition.slug.toLowerCase());
    }

    return true;
  });
}

function buildPrompt(definition) {
  const framing =
    'Square avatar composition, centered subject, clear face visibility, readable at small size, natural detail, cinematic realism, no text overlay.';

  return `${definition.prompt} ${framing} Avoid: ${definition.negativePrompt}.`;
}

async function runpodRequest(url, { method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(`RunPod HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function submitGeneration(definition) {
  const input = {
    prompt: buildPrompt(definition),
    model: definition.model,
    width: 1024,
    height: 1024,
    steps: DEFAULT_STEPS,
    cfg_scale: DEFAULT_CFG_SCALE,
  };

  const submitResponse = await runpodRequest(`https://api.runpod.ai/v2/${ENDPOINT_ID}/run`, {
    method: 'POST',
    body: { input },
  });

  return submitResponse.id;
}

async function waitForImage(jobId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS);

    const statusResponse = await runpodRequest(
      `https://api.runpod.ai/v2/${ENDPOINT_ID}/status/${jobId}`,
    );

    if (statusResponse.status === 'COMPLETED') {
      if (!statusResponse.output?.image) {
        throw new Error(`RunPod completed without image payload for job ${jobId}`);
      }

      return Buffer.from(statusResponse.output.image, 'base64');
    }

    if (
      statusResponse.status === 'FAILED' ||
      statusResponse.status === 'CANCELLED' ||
      statusResponse.error
    ) {
      throw new Error(`RunPod job ${jobId} failed: ${statusResponse.error || statusResponse.status}`);
    }
  }

  throw new Error(`RunPod job ${jobId} timed out after ${POLL_TIMEOUT_MS}ms`);
}

async function encodeAvatar(buffer) {
  const squared = await sharp(buffer)
    .resize(TARGET_SIZE, TARGET_SIZE, {
      fit: 'cover',
      position: 'centre',
    })
    .toBuffer();

  for (const quality of [90, 86, 82, 78, 74, 70, 66, 62]) {
    const encoded = await sharp(squared).webp({ quality }).toBuffer();
    if (encoded.length <= MAX_BYTES) {
      return { buffer: encoded, quality };
    }
  }

  const fallback = await sharp(squared).webp({ quality: 58 }).toBuffer();
  return { buffer: fallback, quality: 58 };
}

async function main() {
  if (!API_KEY) {
    throw new Error('Missing RUNPOD_API_KEY or RUNPOD_IMAGE_API_KEY');
  }

  const options = parseArgs(process.argv.slice(2));
  const definitions = selectDefinitions(options);

  if (definitions.length === 0) {
    throw new Error('No avatars selected. Use --only=<slug> or remove filters.');
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`Generating ${definitions.length} KYNS avatar(s) into ${OUTPUT_DIR}`);

  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const label = `[${index + 1}/${definitions.length}] ${definition.agentName}`;

    console.log(`${label} -> submitting RunPod job`);
    const jobId = await submitGeneration(definition);
    console.log(`${label} -> job ${jobId}`);

    const rawImage = await waitForImage(jobId);
    const { buffer, quality } = await encodeAvatar(rawImage);
    const outputPath = path.join(OUTPUT_DIR, `${definition.slug}.webp`);

    await fs.writeFile(outputPath, buffer);

    console.log(
      `${label} -> saved ${path.basename(outputPath)} (${Math.round(buffer.length / 1024)} KB, webp q=${quality})`,
    );

    if (index < definitions.length - 1) {
      await sleep(REQUEST_PAUSE_MS);
    }
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
