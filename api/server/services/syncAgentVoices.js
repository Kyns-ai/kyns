const { logger } = require('@librechat/data-schemas');

const VOICE_MAP = {
  'Luna': 'cgSgspJ2msm6clMCkdW9',
  'Marina': 'FGY2WhTYpPnrIDTdsKH5',
  'Ísis': 'EXAVITQu4vr4xnSDxMaL',
  'Nala': 'hpp4J3VqNfWAUOO0d1Us',
  'Oráculo': 'pFZP5JQG7iQjIQuC4Bku',
  'Viktor': 'pNInz6obpgDQGcFmaJgB',
  'Dante': 'iP95p4xoKVk53GoZ742B',
  'Gojo Satoru': 'IKne3meq5aSn9XLyUdCD',
  'O Mestre': 'JBFqnCBsd6RMkjVDRZzb',
  'Dr. Mente': 'nPczCjzI2devNBz1zQrb',
};

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
