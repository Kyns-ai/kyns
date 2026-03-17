const fs = require('fs');
const path = require('path');
const { Message, Conversation } = require('~/db/models');
const { logger } = require('~/config');
const paths = require('~/config/paths');

const RETENTION_MS = 24 * 60 * 60 * 1000;
const INTERVAL_MS = 60 * 60 * 1000;

async function purgeExpiredMessages() {
  const expiredConvos = await Conversation.find(
    { expiredAt: { $ne: null } },
    { conversationId: 1 },
  ).lean();

  if (expiredConvos.length === 0) {
    return;
  }

  const expiredConvoIds = expiredConvos.map((c) => c.conversationId);
  const result = await Message.updateMany(
    { expiredAt: null, conversationId: { $in: expiredConvoIds } },
    { $set: { expiredAt: new Date() } },
  );

  if (result.modifiedCount > 0) {
    logger.info(`[kynsDataRetention] Marked ${result.modifiedCount} messages as expired`);
  }
}

async function purgeExpiredConversations() {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  const result = await Conversation.updateMany(
    { expiredAt: null, updatedAt: { $lt: cutoff } },
    { $set: { expiredAt: new Date() } },
  );
  if (result.modifiedCount > 0) {
    logger.info(`[kynsDataRetention] Marked ${result.modifiedCount} conversations as expired`);
  }
}

function purgeOldImages() {
  const generatedDir = path.join(paths.imageOutput, 'generated');
  if (!fs.existsSync(generatedDir)) {
    return;
  }

  const cutoff = Date.now() - RETENTION_MS;
  let deleted = 0;

  for (const file of fs.readdirSync(generatedDir)) {
    const filePath = path.join(generatedDir, file);
    try {
      const { mtimeMs } = fs.statSync(filePath);
      if (mtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    } catch (err) {
      logger.warn(`[kynsDataRetention] Could not delete image ${file}: ${err.message}`);
    }
  }

  if (deleted > 0) {
    logger.info(`[kynsDataRetention] Deleted ${deleted} old generated images`);
  }
}

async function runRetentionCycle() {
  try {
    await Promise.all([purgeExpiredMessages(), purgeExpiredConversations()]);
    purgeOldImages();
  } catch (err) {
    logger.error('[kynsDataRetention] Error during retention cycle:', err.stack ?? err.message ?? String(err));
  }
}

function startKynsDataRetention() {
  logger.info('[kynsDataRetention] Starting 24h data retention scheduler');
  runRetentionCycle();
  setInterval(runRetentionCycle, INTERVAL_MS);
}

module.exports = { startKynsDataRetention };
