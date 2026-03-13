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

  const col = client.db('LibreChat').collection('agents');

  const all = await col
    .find({}, { projection: { _id: 1, name: 1, author: 1, projectIds: 1 } })
    .toArray();

  console.log(`Total de agentes no banco: ${all.length}`);
  all.forEach((a) =>
    console.log(`  _id=${a._id}  name="${a.name}"  projects=${JSON.stringify(a.projectIds)}`),
  );

  const found = all.filter((a) => /kyns.?image|image.*kyns/i.test(a.name ?? ''));

  if (found.length === 0) {
    console.log('\nNenhum agente com nome "Kyns Image" encontrado pelo regex.');
    console.log('Procurando por "image" (case-insensitive)...');
    const imageAgents = all.filter((a) => /image/i.test(a.name ?? ''));
    imageAgents.forEach((a) => console.log(`  CANDIDATO: _id=${a._id}  name="${a.name}"`));
    await client.close();
    return;
  }

  console.log(`\nEncontrados ${found.length} agente(s) para deletar:`);
  found.forEach((a) => console.log(`  _id=${a._id}  name="${a.name}"  author=${a.author}`));

  const result = await col.deleteMany({ _id: { $in: found.map((a) => a._id) } });
  console.log(`Deletados: ${result.deletedCount}`);

  await client.close();
  console.log('Concluído.');
}

run().catch((e) => {
  console.error('Erro:', e.message);
  process.exit(1);
});
