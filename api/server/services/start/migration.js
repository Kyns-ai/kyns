const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const sharp = require('sharp');
const { logger } = require('@librechat/data-schemas');
const { ensureRequiredCollectionsExist } = require('@librechat/api');
const { AccessRoleIds, ResourceType, PrincipalType, Constants } = require('librechat-data-provider');
const {
  logPromptMigrationWarning,
  checkAgentPermissionsMigration,
  checkPromptPermissionsMigration,
} = require('@librechat/api');
const { grantPermission } = require('~/server/services/PermissionService');
const { getProjectByName, addAgentIdsToProject } = require('~/models/Project');
const { Agent, PromptGroup } = require('~/db/models');
const { findRoleByIdentifier } = require('~/models');

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
  const colors = ['#E91E8C','#9C27B0','#3F51B5','#2196F3','#009688','#FF5722','#795548','#607D8B'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

async function generateAvatarPlaceholder(name, outputPath) {
  const color = avatarColorForName(name);
  const initial = (name || '?')[0].toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <circle cx="128" cy="128" r="128" fill="${color}"/>
    <text x="128" y="128" dy="0.35em" text-anchor="middle" font-family="Arial,sans-serif"
      font-size="120" font-weight="bold" fill="rgba(255,255,255,0.95)">${initial}</text>
  </svg>`;
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

async function logAgentAvatarDiagnostics() {
  try {
    const db = mongoose.connection.db;
    if (!db) return;

    const agents = await db.collection('agents').find(
      {},
      { projection: { name: 1, id: 1, avatar: 1, author: 1 } }
    ).toArray();

    const imagesBase = path.resolve(__dirname, '..', '..', '..', '..', 'client', 'public', 'images');
    let restored = 0;

    for (const agent of agents) {
      const av = agent.avatar;
      if (!av || !av.filepath || av.source !== 'local') continue;

      const urlPath = av.filepath.split('?')[0];
      const relPath = urlPath.startsWith('/images/') ? urlPath.slice('/images/'.length) : urlPath;
      const absPath = path.join(imagesBase, relPath);

      if (!fs.existsSync(absPath)) {
        try {
          await generateAvatarPlaceholder(agent.name, absPath);
          restored++;
          logger.info(`[AvatarRestore] Generated placeholder for "${agent.name}"`);
        } catch (e) {
          logger.error(`[AvatarRestore] Failed to generate avatar for "${agent.name}": ${e.message}`);
        }
      }
    }

    if (restored > 0) {
      logger.info(`[AvatarRestore] Restored ${restored} placeholder avatar(s)`);
    }
  } catch (e) {
    logger.error('[AvatarDiag] Error running diagnostics:', e.message);
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

module.exports = {
  checkMigrations,
  logAgentAvatarDiagnostics,
};
