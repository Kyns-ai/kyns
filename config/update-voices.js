const { MongoClient } = require('mongodb');

const VOICES = {
  'Luna': 'luna',
  'Marina': 'marina',
  'Viktor': 'viktor',
  'Dante': 'dante',
  'O Mestre': 'o_mestre',
  'Dr. Mente': 'dr_mente',
  'Nala': 'nala',
  'Gojo Satoru': 'gojo',
};

const VOICES_ACCENTED = {
  '\u00cdsis': 'isis',
  'Or\u00e1culo': 'oraculo',
};

async function run() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();

  const all = { ...VOICES, ...VOICES_ACCENTED };

  for (const [name, voice] of Object.entries(all)) {
    const r = await db.collection('agents').updateMany({ name }, { $set: { voice } });
    console.log(`${name} -> ${voice}: ${r.modifiedCount} updated`);
  }

  await client.close();
  console.log('Done.');
}

run().catch(console.error);
