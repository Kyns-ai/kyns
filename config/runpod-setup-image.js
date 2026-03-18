#!/usr/bin/env node
/**
 * KYNS Image Generation — RunPod Setup Script
 *
 * This script:
 *  1. Creates a 50GB network volume
 *  2. Creates the serverless endpoint using the GHCR image
 *  3. Triggers a warm-up job (downloads models on first run)
 *  4. Prints the RUNPOD_IMAGE_ENDPOINT_ID to set in Railway
 *
 * Usage:
 *   RUNPOD_API_KEY=<key> node config/runpod-setup-image.js
 *
 * Optional env vars:
 *   CIVITAI_TOKEN       — CivitAI API token for faster model downloads
 *   GITHUB_OWNER        — GitHub username/org (default: kyns-ai)
 *   RUNPOD_DATACENTER   — RunPod datacenter ID (default: US-TX-3)
 */

const https = require('https');

const API_KEY = process.env.RUNPOD_API_KEY;
const CIVITAI_TOKEN = process.env.CIVITAI_TOKEN || '';
const GITHUB_OWNER = (process.env.GITHUB_OWNER || 'kyns-ai').toLowerCase();
const DATACENTER = process.env.RUNPOD_DATACENTER || 'US-TX-3';
const DOCKER_IMAGE = `ghcr.io/${GITHUB_OWNER}/kyns-image-worker:latest`;

if (!API_KEY) {
  console.error('ERROR: Set RUNPOD_API_KEY environment variable.');
  console.error('  RUNPOD_API_KEY=<your-key> node config/runpod-setup-image.js');
  process.exit(1);
}

function gql(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = https.request(
      {
        hostname: 'api.runpod.io',
        path: '/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.errors) {
              reject(new Error(JSON.stringify(parsed.errors)));
            } else {
              resolve(parsed.data);
            }
          } catch (e) {
            reject(new Error(`Parse error: ${data}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function runpodPost(path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request(
      {
        hostname: 'api.runpod.ai',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Parse error: ${data}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function runpodGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.runpod.ai',
        path,
        method: 'GET',
        headers: { Authorization: `Bearer ${API_KEY}` },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Parse error: ${data}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createNetworkVolume() {
  console.log('\n[1/3] Creating 50GB network volume...');

  const mutation = `
    mutation saveNetworkVolume($input: SaveNetworkVolumeInput!) {
      saveNetworkVolume(input: $input) {
        id
        name
        size
        dataCenterId
      }
    }
  `;

  const data = await gql(mutation, {
    input: {
      name: 'kyns-image-models',
      size: 50,
      dataCenterId: DATACENTER,
    },
  });

  const vol = data.saveNetworkVolume;
  console.log(`  Network volume created: ${vol.id} (${vol.name}, ${vol.size}GB, ${vol.dataCenterId})`);
  return vol.id;
}

async function createEndpoint(volumeId) {
  console.log('\n[2/3] Creating serverless endpoint...');
  console.log(`  Docker image: ${DOCKER_IMAGE}`);
  console.log(`  GPU: A40, idle timeout: 600s, 0 active / 2 max workers`);

  const mutation = `
    mutation saveEndpoint($input: EndpointInput!) {
      saveEndpoint(input: $input) {
        id
        name
        gpuIds
        idleTimeout
        scalerType
        scalerValue
        workersMin
        workersMax
        flashboot
        networkVolumeId
      }
    }
  `;

  const envVars = [
    { key: 'VOLUME_PATH', value: '/runpod-volume' },
    { key: 'HF_HOME', value: '/runpod-volume/hf-cache' },
    { key: 'TRANSFORMERS_CACHE', value: '/runpod-volume/hf-cache' },
    {
      key: 'LUSTIFY_HF_MODEL',
      value: 'John6666/lustify-sdxl-nsfw-checkpoint-ggwp-v7-sdxl',
    },
    { key: 'LUSTIFY_MODEL', value: 'lustifySDXLNSFW_ggwpV7.safetensors' },
    { key: 'ZIMAGE_HF_MODEL', value: 'stabilityai/sdxl-turbo' },
    { key: 'ZIMAGE_MODEL', value: 'sd_xl_turbo_1.0_fp16.safetensors' },
  ];

  if (CIVITAI_TOKEN) {
    envVars.push({ key: 'CIVITAI_TOKEN', value: CIVITAI_TOKEN });
    console.log('  CivitAI token: provided (Lustify v7 downloads will use it)');
  } else {
    console.log('  WARNING: CIVITAI_TOKEN not set. Lustify v7 download may fail without it.');
    console.log('  Get your token at https://civitai.com/user/account');
  }

  const data = await gql(mutation, {
    input: {
      name: 'kyns-image-gen',
      templateId: null,
      gpuIds: 'AMPERE_48',
      networkVolumeId: volumeId,
      locations: DATACENTER,
      idleTimeout: 600,
      scalerType: 'QUEUE_DELAY',
      scalerValue: 4,
      workersMin: 0,
      workersMax: 2,
      flashboot: true,
      executionTimeoutMs: 600000,
      env: envVars,
      containerDiskInGb: 20,
      dockerImage: DOCKER_IMAGE,
    },
  });

  const ep = data.saveEndpoint;
  console.log(`  Endpoint created: ${ep.id} (flashboot: ${ep.flashboot})`);
  return ep.id;
}

async function triggerWarmup(endpointId) {
  console.log('\n[3/3] Triggering warm-up job (downloads models on first run)...');
  console.log('  This will take 10-20 minutes on first run (downloading ~20GB of models).');
  console.log('  After FlashBoot snapshots, future starts will be fast.');

  const resp = await runpodPost(`/v2/${endpointId}/run`, {
    input: {
      prompt: 'a beautiful landscape, warm sunlight',
      model: 'lustify',
      width: 512,
      height: 512,
      steps: 1,
    },
  });

  const jobId = resp.id;
  if (!jobId) {
    console.log('  Could not submit warm-up job (endpoint may still be starting up). That is OK.');
    console.log('  The first real image request will trigger model download automatically.');
    return;
  }

  console.log(`  Warm-up job submitted: ${jobId}`);
  console.log('  Polling for completion (timeout: 25 min)...');

  const start = Date.now();
  const timeout = 25 * 60 * 1000;

  while (Date.now() - start < timeout) {
    await sleep(15000);
    const status = await runpodGet(`/v2/${endpointId}/status/${jobId}`);
    process.stdout.write(`  Status: ${status.status}...`);

    if (status.status === 'COMPLETED') {
      console.log('\n  Warm-up complete! Models are now cached on the network volume.');
      console.log('  FlashBoot will snapshot this state for faster future starts.');
      return;
    }

    if (status.status === 'FAILED') {
      console.log('\n  Warm-up job failed:', status.error || 'unknown error');
      console.log('  Models will download on the first real user request.');
      return;
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(` (${elapsed}s elapsed)`);
  }

  console.log('\n  Warm-up timed out. Models will finish downloading during first use.');
}

async function main() {
  console.log('=== KYNS Image Generation — RunPod Setup ===');
  console.log(`Docker image: ${DOCKER_IMAGE}`);

  try {
    const volumeId = await createNetworkVolume();
    const endpointId = await createEndpoint(volumeId);

    await triggerWarmup(endpointId);

    console.log('\n=== SETUP COMPLETE ===');
    console.log('\nAdd this environment variable to Railway:');
    console.log(`  RUNPOD_IMAGE_ENDPOINT_ID=${endpointId}`);
    console.log('\nIf CIVITAI_TOKEN was not set, also add it to the RunPod endpoint:');
    console.log('  https://www.runpod.io/console/serverless');
    console.log('  Edit the kyns-image-gen endpoint → Environment Variables → CIVITAI_TOKEN');
  } catch (err) {
    console.error('\nSetup failed:', err.message);
    process.exit(1);
  }
}

main();
