#!/usr/bin/env node
/**
 * Create the RunPod Serverless image generation endpoint for KYNS.
 * Prerequisites:
 *   1. Build Docker image: docker build -t YOUR_DOCKERHUB/kyns-image-gen:latest runpod/image/
 *   2. Push to registry: docker push YOUR_DOCKERHUB/kyns-image-gen:latest
 *   3. Create a network volume in RunPod console (or via API) and get its ID.
 *   4. Set RUNPOD_API_KEY in .env or environment.
 *   5. Run: DOCKER_IMAGE=your/image NETWORK_VOLUME_ID=xxx node config/runpod-create-image-endpoint.js
 *   6. Copy the printed endpoint ID to Railway: RUNPOD_IMAGE_ENDPOINT_ID=xxx
 *   7. Run download_models.sh on a pod with the same network volume to download models.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API_BASE = 'https://rest.runpod.io/v1';
const key = process.env.RUNPOD_API_KEY;

const dockerImage = process.env.DOCKER_IMAGE;
const networkVolumeId = process.env.NETWORK_VOLUME_ID || '';

if (!key) {
  console.error('RUNPOD_API_KEY not set');
  process.exit(1);
}
if (!dockerImage) {
  console.error('Set DOCKER_IMAGE env var, e.g. DOCKER_IMAGE=myuser/kyns-image-gen:latest');
  process.exit(1);
}

async function createTemplate() {
  const res = await fetch(`${API_BASE}/templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'kyns-image-gen',
      imageName: dockerImage,
      containerDiskInGb: 20,
      volumeInGb: 0,
      env: [
        { key: 'VOLUME_PATH', value: '/runpod-volume' },
        { key: 'LUSTIFY_MODEL', value: 'lustifySDXLNSFW_ggwpV7.safetensors' },
        { key: 'ZIMAGE_MODEL', value: 'zImageTurbo_v1.safetensors' },
        { key: 'HF_TOKEN', value: process.env.HF_TOKEN || '' },
      ],
      isServerless: true,
    }),
  });
  if (!res.ok) throw new Error(`Template creation failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function createEndpoint(templateId) {
  const res = await fetch(`${API_BASE}/endpoints`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'kyns-image-gen',
      templateId,
      computeType: 'GPU',
      gpuTypeIds: ['NVIDIA A40'],
      gpuCount: 1,
      workersMin: 0,
      workersMax: 2,
      idleTimeout: 600,
      flashboot: true,
      ...(networkVolumeId ? { networkVolumeId } : {}),
      scalerType: 'QUEUE_DELAY',
      scalerValue: 4,
      executionTimeoutMs: 300000,
    }),
  });
  if (!res.ok) throw new Error(`Endpoint creation failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('Creating RunPod template...');
  const template = await createTemplate();
  console.log('Template created:', template.id);

  console.log('Creating RunPod endpoint...');
  const endpoint = await createEndpoint(template.id);
  console.log('\n✅ Image endpoint created!');
  console.log('   Endpoint ID:', endpoint.id);
  console.log('\nNext steps:');
  console.log('  1. Add to Railway: railway variables set "RUNPOD_IMAGE_ENDPOINT_ID=' + endpoint.id + '"');
  console.log('  2. Download models to network volume (run download_models.sh on a pod).');
  console.log('  3. railway redeploy --yes');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
