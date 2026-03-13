/**
 * Seed agents via the running LibreChat API (no monorepo deps).
 *
 * 1. Endpoint to create an agent: POST /api/agents
 * 2. Auth: POST /api/auth/login with { email, password } → response has { token, user }
 *    Use the token in header: Authorization: Bearer <token>
 *
 * Requires admin credentials (any user with permission to create agents).
 * Set in env: LIBRECHAT_BASE_URL, LIBRECHAT_ADMIN_EMAIL, LIBRECHAT_ADMIN_PASSWORD
 *
 * Usage (from project root):
 *   LIBRECHAT_ADMIN_EMAIL=admin@example.com LIBRECHAT_ADMIN_PASSWORD=xxx node config/seed-agents-api.js [path/to/agents.json]
 *
 * Default agents path: ~/Downloads/agents.json
 * Default base URL: https://chat.kyns.ai
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.LIBRECHAT_BASE_URL || 'https://chat.kyns.ai';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DEFAULT_AGENTS_PATH = path.join(process.env.HOME || process.env.USERPROFILE || '', 'Downloads', 'agents.json');

function loadAgentsJson(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Agents file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('agents.json must be a JSON array of agent objects');
  }
  return data;
}

function buildAgentBody(item) {
  const body = {
    name: item.name ?? 'Unnamed Agent',
    description: item.description ?? undefined,
    instructions: item.instructions ?? undefined,
    provider: item.provider ? String(item.provider).toLowerCase() : item.provider,
    model: item.model ?? null,
    model_parameters: item.model_parameters ?? undefined,
    tools: Array.isArray(item.tools) ? item.tools : [],
    category: item.category ?? 'general',
    authorName: item.authorName ?? undefined,
    support_contact: item.support_contact ?? undefined,
    conversation_starters: item.conversation_starters ?? undefined,
    edges: item.edges ?? undefined,
    end_after_tools: item.end_after_tools,
    hide_sequential_outputs: item.hide_sequential_outputs,
    artifacts: item.artifacts,
    recursion_limit: item.recursion_limit,
    avatar: item.avatar ?? undefined,
    is_promoted: item.is_promoted,
    tool_resources: item.tool_resources ?? undefined,
    tool_options: item.tool_options ?? undefined,
    agent_ids: item.agent_ids,
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
  const url = `${BASE_URL.replace(/\/$/, '')}/api/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (isBanResponse(res, data)) {
    console.error('Conta banida, tente mais tarde');
    process.exit(1);
  }
  if (!res.ok) {
    const text = JSON.stringify(data) || (await res.text());
    throw new Error(`Login failed (${res.status}): ${text}`);
  }
  if (!data.token) {
    throw new Error('Login response missing token');
  }
  return data.token;
}

async function createAgent(token, body) {
  const url = `${BASE_URL.replace(/\/$/, '')}/api/agents`;
  const res = await fetch(url, {
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
    console.error('Conta banida, tente mais tarde');
    process.exit(1);
  }
  if (res.status === 409 || (data?.message || data?.error || '').toLowerCase().includes('duplicat')) {
    return null;
  }
  if (!res.ok) {
    throw new Error(data.message || data.error || res.statusText || `HTTP ${res.status}`);
  }
  return data;
}

async function main() {
  const agentsPath = process.argv[2] || DEFAULT_AGENTS_PATH;
  const email = process.env.LIBRECHAT_ADMIN_EMAIL;
  const password = process.env.LIBRECHAT_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      'Missing credentials. Set LIBRECHAT_ADMIN_EMAIL and LIBRECHAT_ADMIN_PASSWORD (e.g. in .env or export).',
    );
    process.exit(1);
  }

  const items = loadAgentsJson(agentsPath);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Agents file: ${path.resolve(agentsPath)} (${items.length} agents)\n`);

  let token;
  try {
    token = await login(email, password);
    console.log('Login OK.\n');
  } catch (err) {
    console.error('Login failed:', err.message);
    process.exit(1);
  }

  let created = 0;
  let errors = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = (item.name ?? '?').trim();
    if (!item.provider || !item.model) {
      console.log(`[${i + 1}/${items.length}] SKIP "${name}" – provider and model are required`);
      errors++;
      continue;
    }
    try {
      const body = buildAgentBody(item);
      const agent = await createAgent(token, body);
      if (agent === null) {
        console.log(`[${i + 1}/${items.length}] SKIP "${name}" – já existe`);
        continue;
      }
      created++;
      console.log(`[${i + 1}/${items.length}] OK   "${name}" → id: ${agent.id ?? agent._id ?? '—'}`);
    } catch (err) {
      errors++;
      console.log(`[${i + 1}/${items.length}] FAIL "${name}" – ${err.message}`);
    }
    if (i < items.length - 1) await new Promise((r) => setTimeout(r, 5000));
  }

  console.log(`\nDone. Created: ${created}, Errors: ${errors}, Total: ${items.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
