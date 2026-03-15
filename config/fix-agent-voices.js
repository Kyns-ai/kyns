/**
 * Updates voice field on all agents in MongoDB to match ElevenLabs voice IDs.
 * Runs inside Railway via: railway run -- node config/fix-agent-voices.js
 */
const { MongoClient } = require('mongodb');

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

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error('MONGO_URI not set'); process.exit(1); }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('LibreChat');
  const col = db.collection('agents');

  const agents = await col.find({}, { projection: { name: 1, voice: 1, id: 1 } }).toArray();
  console.log(`Found ${agents.length} agents\n`);

  for (const agent of agents) {
    const newVoice = VOICE_MAP[agent.name];
    if (!newVoice) {
      console.log(`  SKIP: ${agent.name} (not in voice map)`);
      continue;
    }
    if (agent.voice === newVoice) {
      console.log(`  OK:   ${agent.name} already has correct voice`);
      continue;
    }
    await col.updateOne({ _id: agent._id }, { $set: { voice: newVoice } });
    console.log(`  FIX:  ${agent.name}: "${agent.voice}" → "${newVoice}"`);
  }

  console.log('\nDone.');
  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
