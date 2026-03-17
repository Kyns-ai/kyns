/**
 * Seed agents in bulk from a JSON file.
 *
 * Uses the same MongoDB connection and env as the app (.env MONGO_URI).
 * Creates each agent with createAgent() and grants AGENT_OWNER + REMOTE_AGENT_OWNER
 * to the admin user (first user with role ADMIN, or first user if none).
 *
 * Usage (from project root):
 *   node config/seed-agents.js [path/to/agents.json]
 *
 * Default path: config/agents.json
 *
 * agents.json format (array of objects):
 *   [
 *     {
 *       "name": "My Agent",
 *       "description": "Optional description",
 *       "instructions": "System instructions...",
 *       "category": "general",
 *       "provider": "openai",
 *       "model": "gpt-4o",
 *       "model_parameters": { "temperature": 0.7, "max_context_tokens": 4096 },
 *       "tools": [],
 *       "authorName": "Optional display name for author"
 *     }
 *   ]
 *
 * Required in each item: name, provider, model.
 * author is set automatically to the admin user.
 */

const path = require('path');
const fs = require('fs');
const { logger } = require('@librechat/data-schemas');
const { nanoid } = require('nanoid');
const { ResourceType, PrincipalType, AccessRoleIds } = require('librechat-data-provider');

require('module-alias/register');
const moduleAlias = require('module-alias');
const basePath = path.resolve(__dirname, '..', 'api');
moduleAlias.addAlias('~', basePath);

const connect = require('./connect');
const { createAgent } = require('~/models/Agent');
const { User } = require('~/db/models');
const { grantPermission } = require('~/server/services/PermissionService');

const DEFAULT_AGENTS_PATH = path.join(__dirname, 'agents.json');

function loadAgentsJson(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Agents file not found: ${resolved}`);
  }
  const raw = fs.readFileSync(resolved, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error('agents.json must be an array of agent objects');
  }
  return data;
}

async function findAdminUserId() {
  const admin = await User.findOne({ role: 'ADMIN' }).select('_id').lean();
  if (admin) {
    return admin._id;
  }
  const first = await User.findOne().select('_id').lean();
  if (first) {
    logger.warn('No user with role ADMIN found; using first user as author');
    return first._id;
  }
  throw new Error('No users in database. Create at least one user (e.g. admin) first.');
}

function buildAgentData(item, authorId) {
  const id = `agent_${nanoid()}`;
  const agentData = {
    id,
    name: item.name ?? 'Unnamed Agent',
    description: item.description ?? undefined,
    instructions: item.instructions ?? undefined,
    provider: item.provider ? String(item.provider).toLowerCase() : item.provider,
    model: item.model ?? null,
    model_parameters: item.model_parameters ?? undefined,
    tools: Array.isArray(item.tools) ? item.tools : [],
    category: item.category ?? 'general',
    author: authorId,
    authorName: item.authorName ?? undefined,
    support_contact: item.support_contact ?? undefined,
    conversation_starters: item.conversation_starters ?? undefined,
    edges: item.edges ?? undefined,
    end_after_tools: item.end_after_tools,
    hide_sequential_outputs: item.hide_sequential_outputs,
    artifacts: item.artifacts,
    recursion_limit: item.recursion_limit,
    avatar: item.avatar,
    is_promoted: item.is_promoted,
    tool_resources: item.tool_resources,
    tool_options: item.tool_options,
    agent_ids: item.agent_ids,
  };
  return agentData;
}

async function seedAgents(agentsFilePath = DEFAULT_AGENTS_PATH) {
  await connect();

  const items = loadAgentsJson(agentsFilePath);
  const authorId = await findAdminUserId();

  logger.info(`Seeding ${items.length} agents with author ${authorId}`);

  let created = 0;
  let errors = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.provider || !item.model) {
      logger.error(`[${i + 1}/${items.length}] Skipping agent "${item.name ?? '?'}": provider and model are required`);
      errors++;
      continue;
    }

    try {
      const agentData = buildAgentData(item, authorId);
      const agent = await createAgent(agentData);

      await Promise.all([
        grantPermission({
          principalType: PrincipalType.USER,
          principalId: authorId,
          resourceType: ResourceType.AGENT,
          resourceId: agent._id,
          accessRoleId: AccessRoleIds.AGENT_OWNER,
          grantedBy: authorId,
        }),
        grantPermission({
          principalType: PrincipalType.USER,
          principalId: authorId,
          resourceType: ResourceType.REMOTE_AGENT,
          resourceId: agent._id,
          accessRoleId: AccessRoleIds.REMOTE_AGENT_OWNER,
          grantedBy: authorId,
        }),
      ]);

      created++;
      logger.info(`[${i + 1}/${items.length}] Created agent "${agent.name}" (${agent.id})`);
    } catch (err) {
      errors++;
      logger.error(`[${i + 1}/${items.length}] Failed to create agent "${item.name ?? '?'}"`, {
        error: err.message,
      });
    }
  }

  return { created, errors, total: items.length };
}

if (require.main === module) {
  const agentsPath = process.argv[2] || DEFAULT_AGENTS_PATH;

  seedAgents(agentsPath)
    .then((result) => {
      console.log('\nSeed result:', result);
      process.exit(result.errors > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seedAgents, loadAgentsJson, findAdminUserId, buildAgentData };
