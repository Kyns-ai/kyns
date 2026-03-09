const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const {
  logPromptMigrationWarning,
  checkAgentPermissionsMigration,
  checkPromptPermissionsMigration,
} = require('@librechat/api');
const { getProjectByName } = require('~/models/Project');
const { Agent, PromptGroup } = require('~/db/models');
const { findRoleByIdentifier } = require('~/models');

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
        '[Migration] ' + agentMigrationResult.totalToMigrate + ' agent(s) need permissions — running auto-migration',
      );
      const { migrateAgentPermissionsEnhanced } = require('../../../../config/migrate-agent-permissions');
      const result = await migrateAgentPermissionsEnhanced({ dryRun: false, batchSize: 50 });
      logger.info('[Migration] Agent permissions migration completed', result);
    }
  } catch (error) {
    logger.error('Failed to check/run agent permissions migration:', error);
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
};
