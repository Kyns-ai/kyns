/**
 * Updates existing agents from JSON (PATCH) and creates only missing ones (POST).
 * Use this to push instructions/config from agents-11-final.json into the 8 existing
 * agents and create only Cael as new.
 *
 * Step 1: Deletes the 9 duplicate agents created by the previous seed (wrong run).
 * Step 2: GET /api/agents, then for each agent in JSON: if name exists → PATCH; if Cael and missing → POST.
 *
 * Requires: LIBRECHAT_BASE_URL, LIBRECHAT_ADMIN_EMAIL, LIBRECHAT_ADMIN_PASSWORD
 * Usage: node config/update-agents-from-json.js [path/to/agents-11-final.json]
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.LIBRECHAT_BASE_URL || 'https://chat.kyns.ai';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DUPLICATE_IDS_TO_DELETE = [
  'agent_2MRJwos00frVn-2Z2v2fG',
  'agent_8qHPvJtYOZSvd4fxSqk8u',
  'agent_e1mFVrCVlhZGcLclntHFI',
  'agent_UbgWDS0t2FeiMwplY5mHB',
  'agent_nOC9VlKLI4zL4jvnnhsbK',
  'agent_nRLf4VUZeRxnsrsC91Yp9',
  'agent_Vy7_rvnorRDxO5wh8tYNm',
  'agent_p-0-I7mbAioq60m5psXAu',
  'agent_8n5zCRRwM8Oif7uNy9WS3',
];

function loadAgentsJson(filePath) {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('JSON must be an array of agents');
  return data;
}

function buildUpdateBody(item) {
  const body = {
    name: item.name ?? undefined,
    description: item.description ?? undefined,
    instructions: item.instructions ?? undefined,
    model: item.model ?? undefined,
    model_parameters: item.model_parameters ?? undefined,
    category: item.category ?? undefined,
    tools: Array.isArray(item.tools) ? item.tools : undefined,
    conversation_starters: item.conversation_starters ?? undefined,
    support_contact: item.support_contact ?? undefined,
    edges: item.edges ?? undefined,
    end_after_tools: item.end_after_tools,
    hide_sequential_outputs: item.hide_sequential_outputs,
    artifacts: item.artifacts,
    recursion_limit: item.recursion_limit,
    tool_resources: item.tool_resources ?? undefined,
    tool_options: item.tool_options ?? undefined,
    voice: item.voice ?? undefined,
  };
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}

function buildCreateBody(item) {
  const body = {
    name: item.name ?? 'Unnamed Agent',
    description: item.description ?? undefined,
    instructions: item.instructions ?? undefined,
    provider: item.provider ? String(item.provider).toLowerCase() : 'openai',
    model: item.model ?? null,
    model_parameters: item.model_parameters ?? undefined,
    tools: Array.isArray(item.tools) ? item.tools : [],
    category: item.category ?? 'general',
    conversation_starters: item.conversation_starters ?? undefined,
    support_contact: item.support_contact ?? undefined,
    edges: item.edges ?? undefined,
    end_after_tools: item.end_after_tools,
    hide_sequential_outputs: item.hide_sequential_outputs,
    artifacts: item.artifacts,
    recursion_limit: item.recursion_limit,
    tool_resources: item.tool_resources ?? undefined,
    tool_options: item.tool_options ?? undefined,
    voice: item.voice ?? undefined,
  };
  return Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
}

function isBanResponse(res, data) {
  if (res.status !== 403) return false;
  const msg = (data?.message || data?.error || '').toLowerCase();
  return msg.includes('ban') || msg.includes('banned') || msg.includes('temporarily');
}

async function login(email, password) {
  const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (isBanResponse(res, data)) {
    console.error('Conta banida, tente mais tarde');
    process.exit(1);
  }
  if (!res.ok) throw new Error(`Login failed (${res.status}): ${JSON.stringify(data)}`);
  if (!data.token) throw new Error('Login response missing token');
  return data.token;
}

async function deleteAgent(token, id) {
  const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/agents/${id}`, {
    method: 'DELETE',
    headers: { 'User-Agent': USER_AGENT, Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (isBanResponse(res, data)) {
    console.error('Conta banida');
    process.exit(1);
  }
  return res.ok;
}

async function listAgents(token) {
  const res = await fetch(
    `${BASE_URL.replace(/\/$/, '')}/api/agents?limit=100`,
    {
      headers: { 'User-Agent': USER_AGENT, Authorization: `Bearer ${token}` },
    },
  );
  const data = await res.json().catch(() => ({}));
  if (isBanResponse(res, data)) {
    console.error('Conta banida');
    process.exit(1);
  }
  if (!res.ok) throw new Error(`List agents failed (${res.status}): ${JSON.stringify(data)}`);
  return data.data ?? [];
}

async function updateAgent(token, id, body) {
  const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/agents/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (isBanResponse(res, data)) {
    console.error('Conta banida');
    process.exit(1);
  }
  if (!res.ok) throw new Error(data.message || data.error || res.statusText || `HTTP ${res.status}`);
  return data;
}

async function createAgent(token, body) {
  const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (isBanResponse(res, data)) {
    console.error('Conta banida');
    process.exit(1);
  }
  if (!res.ok) throw new Error(data.message || data.error || res.statusText || `HTTP ${res.status}`);
  return data;
}

async function main() {
  const email = process.env.LIBRECHAT_ADMIN_EMAIL;
  const password = process.env.LIBRECHAT_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set LIBRECHAT_ADMIN_EMAIL and LIBRECHAT_ADMIN_PASSWORD');
    process.exit(1);
  }

  const jsonPath =
    process.argv[2] || path.join(__dirname, 'agents-11-final.json');
  const items = loadAgentsJson(jsonPath);
  console.log('Base URL:', BASE_URL);
  console.log('Agents in JSON:', items.length, items.map((a) => a.name).join(', '));

  const token = await login(email, password);
  console.log('Login OK.\n');

  console.log('Step 1: Deleting 9 duplicate agents created by previous seed...');
  for (const id of DUPLICATE_IDS_TO_DELETE) {
    const ok = await deleteAgent(token, id);
    console.log(ok ? `  Deleted ${id}` : `  Skip/error ${id}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('');

  console.log('Step 2: Listing existing agents...');
  const existingList = await listAgents(token);
  const byName = new Map();
  for (const a of existingList) {
    const name = (a.name || '').trim();
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, a);
  }
  console.log('  Found by name:', [...byName.keys()].join(', '));
  console.log('');

  console.log('Step 3: Update existing (PATCH) or create Cael (POST)...');
  let updated = 0;
  let created = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = (item.name || '?').trim();
    const existing = byName.get(name);

    if (existing) {
      const body = buildUpdateBody(item);
      if (Object.keys(body).length === 0) {
        console.log(`[${i + 1}/${items.length}] ${name} – nothing to update`);
        continue;
      }
      await updateAgent(token, existing.id, body);
      updated++;
      console.log(`[${i + 1}/${items.length}] PATCH "${name}" OK`);
    } else {
      if (name !== 'Cael') {
        console.log(`[${i + 1}/${items.length}] SKIP "${name}" – not found and not Cael`);
        continue;
      }
      const body = buildCreateBody(item);
      await createAgent(token, body);
      created++;
      console.log(`[${i + 1}/${items.length}] POST "${name}" (new) OK`);
    }
    if (i < items.length - 1) await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('\nDone. Updated:', updated, '| Created:', created, '| Total in JSON:', items.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
