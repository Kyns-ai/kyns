/**
 * Updates voice field on all agents in MongoDB to match ElevenLabs voice IDs.
 * Runs inside Railway via: railway run -- node config/fix-agent-voices.js
 */
const { MongoClient } = require('mongodb');

// Replace with your own ElevenLabs voice IDs from https://elevenlabs.io/app/voice-library
const VOICE_MAP = {
  'Luna': process.env.VOICE_ID_LUNA || '',
  'Marina': process.env.VOICE_ID_MARINA || '',
  'Ísis': process.env.VOICE_ID_ISIS || '',
  'Nala': process.env.VOICE_ID_NALA || '',
  'Oráculo': process.env.VOICE_ID_ORACULO || '',
  'Viktor': process.env.VOICE_ID_VIKTOR || '',
  'Dante': process.env.VOICE_ID_DANTE || '',
  'Gojo Satoru': process.env.VOICE_ID_GOJO || '',
  'O Mestre': process.env.VOICE_ID_MESTRE || '',
  'Dr. Mente': process.env.VOICE_ID_DRMENTE || '',
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
