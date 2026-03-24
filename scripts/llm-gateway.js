#!/usr/bin/env node
/**
 * KYNS LLM Gateway — Proxy com gerenciamento de API keys.
 *
 * Uso:
 *   node scripts/llm-gateway.js serve                      # Inicia o proxy (porta 4000)
 *   node scripts/llm-gateway.js add-key "OpenClaw Mac"     # Cria nova key
 *   node scripts/llm-gateway.js list-keys                  # Lista keys ativas
 *   node scripts/llm-gateway.js revoke-key <id>            # Revoga uma key
 *
 * Env:
 *   LLM_BACKEND_URL    — URL do llama.cpp (ex: https://xxx.proxy.runpod.net/v1)
 *   LLM_BACKEND_KEY    — Master key do llama.cpp
 *   GATEWAY_PORT       — Porta do proxy (default: 4000)
 *   GATEWAY_ADMIN_KEY  — Key para endpoints admin (default: gera na 1a execução)
 *   KEYS_FILE          — Path do arquivo de keys (default: ./data/llm-keys.json)
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const KEYS_FILE = process.env.KEYS_FILE || path.join(__dirname, '..', 'data', 'llm-keys.json');
const BACKEND_URL = process.env.LLM_BACKEND_URL || '';
const BACKEND_KEY = process.env.LLM_BACKEND_KEY || '';
const PORT = parseInt(process.env.GATEWAY_PORT || '4000', 10);
const ADMIN_KEY = process.env.GATEWAY_ADMIN_KEY || '';

function ensureDir() {
  const dir = path.dirname(KEYS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadKeys() {
  ensureDir();
  if (!fs.existsSync(KEYS_FILE)) {
    fs.writeFileSync(KEYS_FILE, '[]', 'utf8');
    return [];
  }
  return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
}

function saveKeys(keys) {
  ensureDir();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), 'utf8');
}

function generateKey() {
  return `sk-kyns-${crypto.randomBytes(24).toString('hex')}`;
}

function addKey(name) {
  const keys = loadKeys();
  const entry = {
    id: crypto.randomBytes(4).toString('hex'),
    key: generateKey(),
    name,
    active: true,
    created: new Date().toISOString(),
    lastUsed: null,
    requests: 0,
  };
  keys.push(entry);
  saveKeys(keys);
  return entry;
}

function listKeys() {
  return loadKeys();
}

function revokeKey(id) {
  const keys = loadKeys();
  const entry = keys.find((k) => k.id === id);
  if (!entry) {
    return null;
  }
  entry.active = false;
  entry.revokedAt = new Date().toISOString();
  saveKeys(keys);
  return entry;
}

function validateKey(apiKey) {
  if (!apiKey) {
    return null;
  }
  const keys = loadKeys();
  const entry = keys.find((k) => k.key === apiKey && k.active);
  if (entry) {
    entry.lastUsed = new Date().toISOString();
    entry.requests += 1;
    saveKeys(keys);
  }
  return entry;
}

function proxyRequest(req, res, backendUrl, backendKey) {
  const url = new URL(req.url, backendUrl);
  const mod = url.protocol === 'https:' ? https : http;

  const headers = { ...req.headers };
  delete headers.host;
  headers['authorization'] = `Bearer ${backendKey}`;

  const proxyReq = mod.request(
    url.href,
    { method: req.method, headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Backend unavailable', type: 'proxy_error' } }));
  });

  req.pipe(proxyReq);
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function extractBearerToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return req.headers['x-api-key'] || '';
}

function startServer() {
  if (!BACKEND_URL || !BACKEND_KEY) {
    console.error('Erro: defina LLM_BACKEND_URL e LLM_BACKEND_KEY');
    console.error('  export LLM_BACKEND_URL=https://xxx.proxy.runpod.net/v1');
    console.error('  export LLM_BACKEND_KEY=sua-master-key');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const token = extractBearerToken(req);

    if (req.url === '/health') {
      return jsonResponse(res, 200, { status: 'ok' });
    }

    if (req.url.startsWith('/admin/')) {
      if (ADMIN_KEY && token !== ADMIN_KEY) {
        return jsonResponse(res, 401, { error: 'Invalid admin key' });
      }

      if (req.url === '/admin/keys' && req.method === 'GET') {
        const keys = listKeys().map((k) => ({
          id: k.id,
          name: k.name,
          key: k.key.slice(0, 12) + '...',
          active: k.active,
          created: k.created,
          lastUsed: k.lastUsed,
          requests: k.requests,
        }));
        return jsonResponse(res, 200, { keys });
      }

      if (req.url === '/admin/keys' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const { name } = JSON.parse(body || '{}');
          if (!name) {
            return jsonResponse(res, 400, { error: 'name required' });
          }
          const entry = addKey(name);
          return jsonResponse(res, 201, {
            id: entry.id,
            key: entry.key,
            name: entry.name,
            message: 'Guarde essa key — ela não será mostrada novamente por completo.',
          });
        });
        return;
      }

      if (req.url.startsWith('/admin/keys/') && req.method === 'DELETE') {
        const id = req.url.split('/admin/keys/')[1];
        const entry = revokeKey(id);
        if (!entry) {
          return jsonResponse(res, 404, { error: 'Key not found' });
        }
        return jsonResponse(res, 200, { message: `Key '${entry.name}' revogada`, id });
      }

      return jsonResponse(res, 404, { error: 'Admin endpoint not found' });
    }

    if (req.url.startsWith('/v1/')) {
      const entry = validateKey(token);
      if (!entry) {
        return jsonResponse(res, 401, {
          error: { message: 'Invalid API Key', type: 'authentication_error', code: 401 },
        });
      }
      return proxyRequest(req, res, BACKEND_URL.replace(/\/v1\/?$/, ''), BACKEND_KEY);
    }

    jsonResponse(res, 404, { error: 'Not found' });
  });

  server.listen(PORT, () => {
    console.log(`KYNS LLM Gateway rodando na porta ${PORT}`);
    console.log(`Backend: ${BACKEND_URL}`);
    console.log(`Keys: ${KEYS_FILE}`);
    console.log(`Admin: ${ADMIN_KEY ? 'protegido' : 'sem senha (defina GATEWAY_ADMIN_KEY)'}`);
    console.log();
    console.log('Endpoints:');
    console.log(`  POST   http://localhost:${PORT}/v1/chat/completions  (requer API key)`);
    console.log(`  GET    http://localhost:${PORT}/admin/keys            (lista keys)`);
    console.log(`  POST   http://localhost:${PORT}/admin/keys            (cria key)`);
    console.log(`  DELETE http://localhost:${PORT}/admin/keys/:id        (revoga key)`);
  });
}

// ── CLI ──────────────────────────────────────────────────────────────

function pad(str, len) {
  return String(str).padEnd(len);
}

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'serve':
    startServer();
    break;

  case 'add-key': {
    const name = args.join(' ') || 'unnamed';
    const entry = addKey(name);
    console.log();
    console.log(`  Key criada!`);
    console.log(`  ID:   ${entry.id}`);
    console.log(`  Nome: ${entry.name}`);
    console.log(`  Key:  ${entry.key}`);
    console.log();
    console.log('  Guarde essa key — ela não será mostrada novamente por completo.');
    break;
  }

  case 'list-keys': {
    const keys = listKeys();
    console.log();
    if (keys.length === 0) {
      console.log('  Nenhuma key criada.');
    } else {
      console.log(`  ${pad('ID',10)} ${pad('Nome',25)} ${pad('Status',10)} ${pad('Requests',10)} Key`);
      console.log(`  ${'-'.repeat(10)} ${'-'.repeat(25)} ${'-'.repeat(10)} ${'-'.repeat(10)} ${'-'.repeat(20)}`);
      for (const k of keys) {
        const status = k.active ? 'ativa' : 'REVOGADA';
        console.log(`  ${pad(k.id,10)} ${pad(k.name,25)} ${pad(status,10)} ${pad(String(k.requests),10)} ${k.key.slice(0, 16)}...`);
      }
    }
    console.log();
    break;
  }

  case 'revoke-key': {
    const id = args[0];
    if (!id) {
      console.error('  Uso: node llm-gateway.js revoke-key <id>');
      process.exit(1);
    }
    const entry = revokeKey(id);
    if (entry) {
      console.log(`  Key '${entry.name}' (${entry.id}) revogada.`);
    } else {
      console.error(`  Key '${id}' não encontrada.`);
    }
    break;
  }

  default:
    console.log(`
  KYNS LLM Gateway — Gerenciamento de API Keys

  Comandos:
    serve                     Inicia o proxy server
    add-key "Nome"            Cria nova API key
    list-keys                 Lista todas as keys
    revoke-key <id>           Revoga uma key

  Exemplo:
    node scripts/llm-gateway.js add-key "OpenClaw Mac Mini"
    node scripts/llm-gateway.js add-key "Teste Externo"
    node scripts/llm-gateway.js list-keys
    node scripts/llm-gateway.js serve
`);
}
