#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');
const Module = require('module');

const apiNodeModulesPath = path.resolve(__dirname, '../api/node_modules');
process.env.NODE_PATH = [process.env.NODE_PATH, apiNodeModulesPath].filter(Boolean).join(path.delimiter);
Module._initPaths();

const mongoose = require('mongoose');
const { connectDb } = require('../api/db/connect');
const { Agent } = require('../api/db/models');
const { kynsAgentAvatarDefinitions } = require('./kynsAgentAvatarDefinitions');

const BASE_URL = (process.env.LIBRECHAT_BASE_URL || 'https://chat.kyns.ai').replace(/\/$/, '');
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const AVATAR_DIR = path.resolve(__dirname, 'kyns-agent-avatars');

function parseArgs(argv) {
  const options = {
    mode: 'auto',
    only: new Set(),
  };

  for (const arg of argv) {
    if (arg.startsWith('--mode=')) {
      options.mode = arg.slice('--mode='.length).trim();
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

function selectDefinitions(options) {
  return kynsAgentAvatarDefinitions.filter((definition) => {
    if (options.only.size > 0) {
      return options.only.has(definition.slug.toLowerCase());
    }

    return true;
  });
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') {
    return 'image/png';
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    return 'image/jpeg';
  }

  return 'image/webp';
}

async function login() {
  const email = process.env.LIBRECHAT_ADMIN_EMAIL;
  const password = process.env.LIBRECHAT_ADMIN_PASSWORD;

  if (!email || !password) {
    return null;
  }

  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.token) {
    throw new Error(`Admin login failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data.token;
}

async function listAgentsByName(token) {
  const response = await fetch(`${BASE_URL}/api/agents?limit=100`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`List agents failed: ${response.status} ${raw.slice(0, 500)}`);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`List agents returned non-JSON payload: ${raw.slice(0, 500)}`);
  }

  const byName = new Map();
  for (const agent of payload.data || []) {
    const name = typeof agent.name === 'string' ? agent.name.trim() : '';
    if (!name) {
      continue;
    }

    if (!byName.has(name)) {
      byName.set(name, []);
    }

    byName.get(name).push(agent);
  }

  return byName;
}

async function uploadViaApi(token, definitions) {
  const agentsByName = await listAgentsByName(token);

  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const filePath = path.join(AVATAR_DIR, `${definition.slug}.webp`);
    const fileBuffer = await fs.readFile(filePath);
    const matchingAgents = agentsByName.get(definition.agentName) || [];

    if (matchingAgents.length === 0) {
      throw new Error(`Agent not found via API: ${definition.agentName}`);
    }

    for (const agent of matchingAgents) {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([fileBuffer], { type: 'image/webp' }),
        `${definition.slug}.webp`,
      );

      const response = await fetch(`${BASE_URL}/api/files/images/agents/${agent.id}/avatar`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': USER_AGENT,
        },
        body: formData,
      });

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(
          `Avatar upload failed for ${definition.agentName} (${agent.id}): ${response.status} ${raw.slice(0, 500)}`,
        );
      }

      console.log(
        `[API ${index + 1}/${definitions.length}] ${definition.agentName} -> ${agent.id} uploaded`,
      );
    }
  }
}

function toDataUri(buffer, mimeType) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function buildVersionEntry(agentObject, avatar) {
  const { __v, _id, id, versions, author, ...versionData } = agentObject;
  return {
    ...versionData,
    avatar,
    updatedAt: new Date(),
    updatedBy: new mongoose.Types.ObjectId(author),
  };
}

async function uploadViaMongo(definitions) {
  if (!process.env.MONGO_URI) {
    throw new Error('Missing MONGO_URI for Mongo fallback');
  }

  await connectDb();

  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const filePath = path.join(AVATAR_DIR, `${definition.slug}.webp`);
    const fileBuffer = await fs.readFile(filePath);
    const avatar = {
      filepath: toDataUri(fileBuffer, getMimeType(filePath)),
      source: 'local',
    };

    const agents = await Agent.find({ name: definition.agentName });
    if (agents.length === 0) {
      throw new Error(`Agent not found in Mongo: ${definition.agentName}`);
    }

    for (const agent of agents) {
      const agentObject = agent.toObject();
      const versionEntry = buildVersionEntry(agentObject, avatar);

      await Agent.updateOne(
        { _id: agent._id },
        {
          $set: {
            avatar,
            updatedAt: new Date(),
          },
          $push: {
            versions: versionEntry,
          },
        },
      );

      console.log(
        `[Mongo ${index + 1}/${definitions.length}] ${definition.agentName} -> ${agent.id} updated`,
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const definitions = selectDefinitions(options);

  if (definitions.length === 0) {
    throw new Error('No avatars selected. Use --only=<slug> or remove filters.');
  }

  for (const definition of definitions) {
    const filePath = path.join(AVATAR_DIR, `${definition.slug}.webp`);
    await fs.access(filePath);
  }

  let mode = options.mode;
  if (!['auto', 'api', 'mongo'].includes(mode)) {
    throw new Error(`Invalid mode "${mode}". Use auto, api, or mongo.`);
  }

  if (mode === 'auto') {
    mode = process.env.LIBRECHAT_ADMIN_EMAIL && process.env.LIBRECHAT_ADMIN_PASSWORD ? 'api' : 'mongo';
  }

  if (mode === 'api') {
    try {
      const token = await login();
      if (!token) {
        throw new Error('Admin credentials not available');
      }

      await uploadViaApi(token, definitions);
      console.log('Done via API.');
      return;
    } catch (error) {
      if (options.mode === 'api') {
        throw error;
      }

      console.warn(`API upload failed, falling back to Mongo: ${error.message}`);
      mode = 'mongo';
    }
  }

  if (mode === 'mongo') {
    await uploadViaMongo(definitions);
    console.log('Done via Mongo.');
  }
}

main()
  .catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
