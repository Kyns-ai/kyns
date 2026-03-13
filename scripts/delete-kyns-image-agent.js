#!/usr/bin/env node
'use strict';

const { MongoClient } = require('mongodb');

const uri =
  process.env.MONGO_URI ||
  'mongodb://mongo:68eca824oqwbofbsk82mjy8jofi8vn1t@roundhouse.proxy.rlwy.net:40487/?authSource=admin';

async function run() {
  console.log('Conectando ao MongoDB...');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  console.log('Conectado!');

  const adminDb = client.db('admin');
  const dbList = await adminDb.admin().listDatabases();
  console.log('Todos os bancos de dados:');
  dbList.databases.forEach((d) => console.log(` - ${d.name} (${d.sizeOnDisk} bytes)`));

  for (const dbInfo of dbList.databases) {
    if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;
    const db = client.db(dbInfo.name);
    const cols = await db.listCollections().toArray();
    console.log(`\n[${dbInfo.name}] coleções:`, cols.map((c) => c.name).join(', '));
    if (cols.some((c) => /agent/i.test(c.name))) {
      const col = db.collection('agents');
      const docs = await col
        .find({}, { projection: { _id: 1, name: 1 } })
        .toArray();
      console.log(`  agents: ${docs.length} docs`);
      docs.forEach((d) => console.log(`    _id=${d._id}  name="${d.name}"`));
    }
  }

  await client.close();
  console.log('Concluído.');
}

run().catch((e) => {
  console.error('Erro:', e.message);
  process.exit(1);
});
