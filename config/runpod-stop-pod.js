#!/usr/bin/env node
/**
 * Stop a RunPod Pod via REST API.
 * Uses RUNPOD_API_KEY and RUNPOD_POD_ID from .env (or env).
 * Usage: RUNPOD_POD_ID=xxx node config/runpod-stop-pod.js
 *        Or set RUNPOD_POD_ID in .env.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API_BASE = 'https://rest.runpod.io/v1';
const key = process.env.RUNPOD_API_KEY;
const podId = process.env.RUNPOD_POD_ID;

async function listPods() {
  const res = await fetch(`${API_BASE}/pods?desiredStatus=RUNNING`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`List pods failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function stopPod(id) {
  const res = await fetch(`${API_BASE}/pods/${id}/stop`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`Stop pod failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  if (!key) {
    console.error('RUNPOD_API_KEY not set in .env');
    process.exit(1);
  }
  let targetId = podId;
  if (!targetId) {
    const pods = await listPods();
    if (!Array.isArray(pods) || pods.length === 0) {
      console.log('No RUNNING pods found.');
      process.exit(0);
    }
    targetId = pods[0].id;
    console.log(`Using first RUNNING pod: ${pods[0].name || targetId} (${targetId})`);
  }
  await stopPod(targetId);
  console.log(`Pod ${targetId} stop requested.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
