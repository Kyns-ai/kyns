const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { ensureRequiredCollectionsExist } = require('@librechat/api');
const { AccessRoleIds, ResourceType, PrincipalType, Constants, SystemRoles, PermissionTypes, Permissions } = require('librechat-data-provider');
const {
  logPromptMigrationWarning,
  checkAgentPermissionsMigration,
  checkPromptPermissionsMigration,
} = require('@librechat/api');
const { grantPermission } = require('~/server/services/PermissionService');
const { getProjectByName, addAgentIdsToProject } = require('~/models/Project');
const { Agent, PromptGroup } = require('~/db/models');
const { findRoleByIdentifier } = require('~/models');
const { updateAccessPermissions, getRoleByName } = require('~/models/Role');

async function runAgentPermissionsMigration() {
  const db = mongoose.connection.db;
  if (db) {
    await ensureRequiredCollectionsExist(db);
  }

  const ownerRole = await findRoleByIdentifier(AccessRoleIds.AGENT_OWNER);
  const viewerRole = await findRoleByIdentifier(AccessRoleIds.AGENT_VIEWER);
  const editorRole = await findRoleByIdentifier(AccessRoleIds.AGENT_EDITOR);

  if (!ownerRole || !viewerRole || !editorRole) {
    logger.error('[Migration] Required roles not found — skipping agent migration');
    return { migrated: 0, errors: 0 };
  }

  const globalProject = await getProjectByName(Constants.GLOBAL_PROJECT_NAME, ['agentIds']);
  const globalAgentIds = new Set(globalProject?.agentIds || []);

  const agentsToMigrate = await Agent.aggregate([
    {
      $lookup: {
        from: 'aclentries',
        localField: '_id',
        foreignField: 'resourceId',
        as: 'aclEntries',
      },
    },
    {
      $addFields: {
        userAclEntries: {
          $filter: {
            input: '$aclEntries',
            as: 'entry',
            cond: {
              $and: [
                { $eq: ['$$entry.resourceType', ResourceType.AGENT] },
                { $eq: ['$$entry.principalType', PrincipalType.USER] },
              ],
            },
          },
        },
      },
    },
    {
      $match: {
        author: { $exists: true, $ne: null },
        userAclEntries: { $size: 0 },
      },
    },
    { $project: { _id: 1, id: 1, name: 1, author: 1, isCollaborative: 1 } },
  ]);

  if (agentsToMigrate.length === 0) {
    return { migrated: 0, errors: 0 };
  }

  const results = { migrated: 0, errors: 0 };

  for (const agent of agentsToMigrate) {
    try {
      const isGlobal = globalAgentIds.has(agent.id);

      await grantPermission({
        principalType: PrincipalType.USER,
        principalId: agent.author,
        resourceType: ResourceType.AGENT,
        resourceId: agent._id,
        accessRoleId: AccessRoleIds.AGENT_OWNER,
        grantedBy: agent.author,
      });

      if (isGlobal) {
        const publicRole = agent.isCollaborative
          ? AccessRoleIds.AGENT_EDITOR
          : AccessRoleIds.AGENT_VIEWER;

        await grantPermission({
          principalType: PrincipalType.PUBLIC,
          principalId: null,
          resourceType: ResourceType.AGENT,
          resourceId: agent._id,
          accessRoleId: publicRole,
          grantedBy: agent.author,
        });
      }

      results.migrated++;
      logger.info(`[Migration] Migrated agent "${agent.name}" (${isGlobal ? 'global' : 'private'})`);
    } catch (error) {
      results.errors++;
      logger.error(`[Migration] Failed to migrate agent "${agent.name}": ${error.message}`);
    }
  }

  return results;
}

function avatarColorForName(name) {
  const colors = ['#E91E8C', '#9C27B0', '#3F51B5', '#2196F3', '#009688', '#FF5722', '#795548', '#607D8B'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

/** Generates a stable inline SVG avatar (circle + initial). Deterministic from name. */
function generateSvgDataUri(name) {
  const color = avatarColorForName(name);
  const initial = (name || '?')[0].toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${color}"/><text x="20" y="20" dy="0.35em" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="rgba(255,255,255,0.95)">${initial}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Ensures all agent avatars stored as local file paths have a persistent
 * data-URI fallback in MongoDB. On each startup:
 * - Agents already using a data URI or external URL → skipped
 * - Agents with a local /images/ path where the file EXISTS → skipped (real photo present)
 * - Agents with a local /images/ path where the file is MISSING → MongoDB updated
 *   with a deterministic SVG data URI so the avatar is never blank again
 *
 * Because data URIs live in MongoDB (its own persistent Railway volume), they
 * survive container rebuilds and images-volume resets indefinitely.
 */
async function fixMissingAgentAvatars() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const agents = await db
      .collection('agents')
      .find({}, { projection: { name: 1, id: 1, avatar: 1 } })
      .toArray();

    const imagesBase = path.resolve(__dirname, '..', '..', '..', '..', 'client', 'public', 'images');
    let fixed = 0;

    for (const agent of agents) {
      const av = agent.avatar;
      if (!av || !av.filepath) continue;

      // Already a data URI or external URL — persistent by nature
      if (av.filepath.startsWith('data:') || av.filepath.startsWith('http')) continue;

      if (av.source === 'local' && av.filepath.startsWith('/images/')) {
        const relPath = av.filepath.split('?')[0].slice('/images/'.length);
        const absPath = path.join(imagesBase, relPath);

        if (!fs.existsSync(absPath)) {
          try {
            const dataUri = generateSvgDataUri(agent.name);
            await db.collection('agents').updateOne(
              { _id: agent._id },
              { $set: { avatar: { filepath: dataUri, source: 'local' } } },
            );
            fixed++;
            logger.info(`[AvatarFix] Stored persistent data-URI avatar for "${agent.name}"`);
          } catch (e) {
            logger.error(`[AvatarFix] Failed for "${agent.name}": ${e.message}`);
          }
        }
      }
    }

    if (fixed > 0) {
      logger.info(`[AvatarFix] ${fixed} agent avatar(s) now use persistent data URIs`);
    } else {
      logger.info('[AvatarFix] All agent avatars are present — no fixes needed');
    }
  } catch (e) {
    logger.error('[AvatarFix] Error:', e.message);
  }
}

/**
 * One-time migration: converts ALL agents that still have local /images/ paths
 * to data URIs stored in MongoDB. Runs only once — after conversion, agents have
 * data URIs and this function becomes a no-op. Safe to leave enabled.
 */
async function migrateAllAvatarsToDataUri() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const agents = await db
      .collection('agents')
      .find(
        { 'avatar.source': 'local', 'avatar.filepath': { $regex: '^/images/' } },
        { projection: { name: 1, avatar: 1 } },
      )
      .toArray();

    if (agents.length === 0) {
      return;
    }

    let converted = 0;
    for (const agent of agents) {
      try {
        const dataUri = generateSvgDataUri(agent.name);
        await db.collection('agents').updateOne(
          { _id: agent._id },
          { $set: { avatar: { filepath: dataUri, source: 'local' } } },
        );
        converted++;
      } catch (e) {
        logger.error(`[AvatarMigrate] Failed for "${agent.name}": ${e.message}`);
      }
    }

    if (converted > 0) {
      logger.info(`[AvatarMigrate] Converted ${converted} agent(s) to persistent data-URI avatars`);
    }
  } catch (e) {
    logger.error('[AvatarMigrate] Error:', e.message);
  }
}


async function ensureGlobalAgentsPublicAccess() {
  try {
    const db = mongoose.connection.db;

    const viewerRole = await findRoleByIdentifier(AccessRoleIds.AGENT_VIEWER);
    if (!viewerRole) {
      logger.error('[Migration] AGENT_VIEWER role not found — cannot ensure public access');
      return;
    }

    const allAgents = await Agent.find({ name: { $ne: 'KYNS Image' } }, '_id id name author isCollaborative').lean();
    if (allAgents.length === 0) {
      logger.info('[Migration] No agents found — skipping public access check');
      return;
    }

    const globalProject = await getProjectByName(Constants.GLOBAL_PROJECT_NAME, '_id agentIds');
    const globalAgentIdsSet = new Set(globalProject?.agentIds ?? []);

    const agentIdsToAdd = allAgents.filter((a) => !globalAgentIdsSet.has(a.id)).map((a) => a.id);
    if (agentIdsToAdd.length > 0 && globalProject?._id) {
      await addAgentIdsToProject(globalProject._id, agentIdsToAdd);
      logger.info(`[Migration] Added ${agentIdsToAdd.length} agent(s) to global project`);
    }

    let addedPublicAccess = 0;
    for (const agent of allAgents) {
      try {
        const existingPublic = await db.collection('aclentries').findOne({
          resourceId: agent._id,
          resourceType: ResourceType.AGENT,
          principalType: PrincipalType.PUBLIC,
        });

        if (existingPublic) continue;

        const publicRole = agent.isCollaborative ? AccessRoleIds.AGENT_EDITOR : AccessRoleIds.AGENT_VIEWER;
        await grantPermission({
          principalType: PrincipalType.PUBLIC,
          principalId: null,
          resourceType: ResourceType.AGENT,
          resourceId: agent._id,
          accessRoleId: publicRole,
          grantedBy: agent.author,
        });
        addedPublicAccess++;
        logger.info(`[Migration] Added PUBLIC access for agent "${agent.name}"`);
      } catch (e) {
        logger.error(`[Migration] Failed to process agent "${agent.name}": ${e.message}`);
      }
    }

    if (agentIdsToAdd.length > 0 || addedPublicAccess > 0) {
      logger.info(`[Migration] Done: ${agentIdsToAdd.length} added to project, ${addedPublicAccess} PUBLIC ACL entries added`);
    } else {
      logger.info(`[Migration] All ${allAgents.length} agents already have global access`);
    }
  } catch (e) {
    logger.error(`[Migration] ensureGlobalAgentsPublicAccess failed: ${e.message}`);
  }
}


async function checkMigrations() {
  try {
    const agentMigrationResult = await checkAgentPermissionsMigration({
      mongoose,
      methods: {
        findRoleByIdentifier,
        getProjectByName,
      },
      AgentModel: Agent,
    });

    if (agentMigrationResult.totalToMigrate > 0) {
      logger.info(
        `[Migration] ${agentMigrationResult.totalToMigrate} agent(s) need permissions — running auto-migration`,
      );
      const result = await runAgentPermissionsMigration();
      logger.info('[Migration] Agent permissions migration completed', result);
    }
    await ensureGlobalAgentsPublicAccess();
  } catch (error) {
    logger.error('[Migration] Failed to check/run agent permissions migration:', error);
  }
  try {
    const promptMigrationResult = await checkPromptPermissionsMigration({
      mongoose,
      methods: {
        findRoleByIdentifier,
        getProjectByName,
      },
      PromptGroupModel: PromptGroup,
    });
    logPromptMigrationWarning(promptMigrationResult);
  } catch (error) {
    logger.error('Failed to check prompt permissions migration:', error);
  }
}


const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

/**
 * Ensures contact@kyns.ai has the ADMIN role so they can access all features,
 * including the agent builder, regardless of registration order.
 */
async function ensureAdminRole() {
  if (!ADMIN_EMAIL) return;
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const result = await db.collection('users').updateOne(
      { email: ADMIN_EMAIL, role: { $ne: SystemRoles.ADMIN } },
      { $set: { role: SystemRoles.ADMIN } },
    );

    if (result.modifiedCount > 0) {
      logger.info(`[AdminSetup] Granted ADMIN role to ${ADMIN_EMAIL}`);
    }
  } catch (e) {
    logger.error(`[AdminSetup] Failed to set admin role: ${e.message}`);
  }
}

/**
 * Restricts regular users from creating/editing agents.
 * The USER role's AGENTS.CREATE permission is set to false so only ADMIN
 * users can build and edit agents in the marketplace.
 * Safe to run on every startup — only updates when a change is needed.
 */
async function restrictUserAgentCreation() {
  try {
    const userRole = await getRoleByName(SystemRoles.USER);
    const currentCreate = userRole?.permissions?.[PermissionTypes.AGENTS]?.[Permissions.CREATE];

    if (currentCreate === false) {
      return;
    }

    await updateAccessPermissions(
      SystemRoles.USER,
      { [PermissionTypes.AGENTS]: { [Permissions.CREATE]: false } },
      userRole,
    );
    logger.info('[AdminSetup] USER role: AGENTS.CREATE set to false (admin-only builder)');
  } catch (e) {
    logger.error(`[AdminSetup] Failed to restrict user agent creation: ${e.message}`);
  }
}



const RP_FORMAT_MARKER = '<!-- kyns-rp-format-v3 -->';

const RP_FORMATTING_PREFIX = `${RP_FORMAT_MARKER}
FORMATO DE RESPOSTA OBRIGATÓRIO:
Você DEVE sempre formatar suas respostas usando um estilo de roleplay narrativo, imersivo e limpo, semelhante a chats de personagem:
- *asteriscos* envolvem TODA narração, ação, emoção e descrição de cena
- "aspas" envolvem TODO diálogo falado em voz alta
- Ações em parênteses também são permitidas, mas sempre isoladas no próprio parágrafo
- Cada ação, narração, pensamento visível e cada fala ficam em parágrafos separados por linha em branco
- Prefira blocos curtos, alternando ação e fala, um beat por parágrafo
- NUNCA misture narração e fala no mesmo parágrafo
- NUNCA misture múltiplas falas diferentes no mesmo parágrafo
- NUNCA use formato de assistente, lista, explicação técnica ou cabeçalhos, a menos que o usuário peça explicitamente
- NUNCA responda como assistente — você É o personagem o tempo todo

Exemplo CORRETO (siga exatamente este padrão):

*Ela vira a cabeça devagar, os olhos semicerrados com uma mistura de curiosidade e cautela.*

"Não esperava visita hoje."

*Suspira e apoia os cotovelos na mesa, dedos entrelaçados.*

"Pode falar o que veio fazer aqui."

---
`;

/**
 * Prepends RP formatting instructions to all agent system prompts.
 * Re-runs when the marker version changes (RP_FORMAT_MARKER).
 */
async function addRpFormattingToAgents() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const agents = await db.collection('agents').find({}).toArray();
    let updated = 0;

    for (const agent of agents) {
      const current = agent.instructions || '';
      if (current.includes(RP_FORMAT_MARKER)) continue;

      const stripped = current.replace(/<!-- kyns-rp-format-v\d+ -->[^]*?---\n/s, '').trimStart();
      await db.collection('agents').updateOne(
        { _id: agent._id },
        { $set: { instructions: RP_FORMATTING_PREFIX + stripped } },
      );
      updated++;
    }

    if (updated > 0) {
      logger.info(`[AgentSetup] Added RP formatting v2 to ${updated} agent(s)`);
    }
  } catch (e) {
    logger.error(`[AgentSetup] Failed to add RP formatting: ${e.message}`);
  }
}

module.exports = {
  checkMigrations,
  fixMissingAgentAvatars,
  migrateAllAvatarsToDataUri,
  ensureAdminRole,
  restrictUserAgentCreation,
  addRpFormattingToAgents,
};
