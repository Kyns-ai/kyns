/**
 * Diagnose agent chat flow: login → POST /api/agents/chat → GET /api/agents/chat/stream/:streamId
 * Use so we can see in railway logs what happens (POST received, Job created, GET requested, Job found or not).
 *
 * Requires: LIBRECHAT_BASE_URL, LIBRECHAT_ADMIN_EMAIL, LIBRECHAT_ADMIN_PASSWORD
 * Optional: LIBRECHAT_AGENT_ID (default: first agent from GET /api/agents)
 *
 * Run from project root:
 *   node config/diagnose-agent-chat.js
 * Or with Railway env (if credentials are in vars):
 *   railway run node config/diagnose-agent-chat.js
 */
const BASE_URL = (process.env.LIBRECHAT_BASE_URL || 'https://chat.kyns.ai').replace(/\/$/, '');
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function main() {
  const email = process.env.LIBRECHAT_ADMIN_EMAIL;
  const password = process.env.LIBRECHAT_ADMIN_PASSWORD;
  if (!email || !password) {
    console.error('Set LIBRECHAT_ADMIN_EMAIL and LIBRECHAT_ADMIN_PASSWORD (e.g. in .env or export)');
    process.exit(1);
  }

  const headers = (token) => ({
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  console.log('1. Login...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) {
    console.error('Login failed', loginRes.status, loginData);
    process.exit(1);
  }
  const token = loginData.token;
  if (!token) {
    console.error('No token in login response', loginData);
    process.exit(1);
  }
  console.log('   OK');

  let agentId = process.env.LIBRECHAT_AGENT_ID;
  if (!agentId) {
    console.log('2. List agents...');
    const listRes = await fetch(`${BASE_URL}/api/agents?limit=1`, {
      headers: headers(token),
    });
    const listData = await listRes.json().catch(() => ({}));
    const agents = listData?.data ?? listData?.agents ?? [];
    agentId = agents[0]?.id;
    if (!agentId) {
      console.error('No agents found and LIBRECHAT_AGENT_ID not set');
      process.exit(1);
    }
    console.log('   Using agent', agentId);
  }

  const conversationId = `diagnose-${Date.now()}`;
  console.log('3. POST /api/agents/chat...');
  const postRes = await fetch(`${BASE_URL}/api/agents/chat`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      text: 'Diagnóstico: mensagem de teste.',
      messageId: `msg-${Date.now()}`,
      parentMessageId: '00000000-0000-0000-0000-000000000000',
      conversationId,
      endpoint: 'agents',
      agent_id: agentId,
      model: agentId,
    }),
  });
  const postData = await postRes.json().catch(() => ({}));
  if (!postRes.ok) {
    console.error('   POST failed', postRes.status, postData);
    process.exit(1);
  }
  const streamId = postData.streamId ?? postData.conversationId;
  if (!streamId) {
    console.error('   No streamId in response', postData);
    process.exit(1);
  }
  console.log('   OK streamId=', streamId);

  console.log('4. GET /api/agents/chat/stream/' + streamId + '...');
  const streamRes = await fetch(`${BASE_URL}/api/agents/chat/stream/${encodeURIComponent(streamId)}`, {
    headers: headers(token),
  });
  if (streamRes.status === 404) {
    const body = await streamRes.text();
    console.error('   GET 404 – Job not found (likely POST and GET hit different replicas; use Redis or 1 replica)');
    console.error('   Body:', body.slice(0, 200));
    process.exit(1);
  }
  if (!streamRes.ok) {
    console.error('   GET failed', streamRes.status, await streamRes.text().then((t) => t.slice(0, 200)));
    process.exit(1);
  }
  console.log('   OK – stream connected. Check railway logs for [AgentChat] lines.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
