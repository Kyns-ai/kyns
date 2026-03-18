const { logger } = require('@librechat/data-schemas');

let VOICE_MAP = {};
try {
  if (process.env.KYNS_VOICE_MAP) {
    VOICE_MAP = JSON.parse(process.env.KYNS_VOICE_MAP);
  }
} catch {
  logger.warn('[VoiceSync] Invalid KYNS_VOICE_MAP env var, voice sync disabled');
}

async function syncAgentVoices(mongoose) {
  try {
    const Agent = mongoose.models.Agent ?? mongoose.model('Agent', new mongoose.Schema({}, { strict: false }));
    const agents = await Agent.find({}, 'name voice').lean();
    let fixed = 0;

    for (const agent of agents) {
      const expected = VOICE_MAP[agent.name];
      if (!expected) continue;
      if (agent.voice === expected) continue;

      await Agent.updateOne({ _id: agent._id }, { $set: { voice: expected } });
      logger.info(`[VoiceSync] ${agent.name}: "${agent.voice}" → "${expected}"`);
      fixed++;
    }

    if (fixed > 0) {
      logger.info(`[VoiceSync] Fixed ${fixed} agent voices`);
    } else {
      logger.info('[VoiceSync] All agent voices are correct');
    }
  } catch (err) {
    logger.error('[VoiceSync] Error:', err.message);
  }
}

module.exports = { syncAgentVoices };
