/**
 * Patches conversation_starters for existing agents by name via the LibreChat API.
 *
 * Reads a JSON file with [{ name, conversation_starters }] entries,
 * finds each agent by name, and PATCHes only the conversation_starters field.
 *
 * Requires: LIBRECHAT_BASE_URL, LIBRECHAT_ADMIN_EMAIL, LIBRECHAT_ADMIN_PASSWORD
 *
 * Usage (from project root):
 *   node config/update-starters.js [path/to/agents-starters-patch.json]
 *
 * Default path: config/agents-starters-patch.json
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.LIBRECHAT_BASE_URL || 'https://chat.kyns.ai';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEFAULT_PATH = path.join(__dirname, 'agents-starters-patch.json');

function loadJson(filePath) {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('JSON must be an array');
  return data;
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

async function listAgents(token) {
  const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/agents?limit=100`, {
    headers: { 'User-Agent': USER_AGENT, Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (isBanResponse(res, data)) {
    console.error('Conta banida');
    process.exit(1);
  }
  if (!res.ok) throw new Error(`List agents failed (${res.status}): ${JSON.stringify(data)}`);
  return data.data ?? [];
}

async function patchAgent(token, id, conversation_starters) {
  const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/api/agents/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ conversation_starters }),
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

  const jsonPath = process.argv[2] || DEFAULT_PATH;
  const items = loadJson(jsonPath);
  console.log('Base URL:', BASE_URL);
  console.log('Agents in patch file:', items.length, items.map((a) => a.name).join(', '));

  const token = await login(email, password);
  console.log('Login OK.\n');

  const existingList = await listAgents(token);
  const byName = new Map();
  for (const agent of existingList) {
    const name = (agent.name || '').trim();
    if (name && !byName.has(name)) byName.set(name, agent);
  }
  console.log('Agents found in DB:', [...byName.keys()].join(', '));
  console.log('');

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = (item.name || '?').trim();
    const existing = byName.get(name);

    if (!existing) {
      console.log(`[${i + 1}/${items.length}] SKIP "${name}" — not found in DB`);
      skipped++;
      continue;
    }

    if (!Array.isArray(item.conversation_starters) || item.conversation_starters.length === 0) {
      console.log(`[${i + 1}/${items.length}] SKIP "${name}" — no conversation_starters in patch file`);
      skipped++;
      continue;
    }

    await patchAgent(token, existing.id, item.conversation_starters);
    updated++;
    console.log(`[${i + 1}/${items.length}] PATCH "${name}" OK (${item.conversation_starters.length} starters)`);

    if (i < items.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\nDone. Updated: ${updated} | Skipped: ${skipped} | Total: ${items.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
