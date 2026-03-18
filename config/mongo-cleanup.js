/**
 * MongoDB Cleanup & Stats Script
 * 
 * Usage: node config/mongo-cleanup.js [--dry-run] [--days=90]
 * 
 * O que faz:
 * 1. Mostra estatísticas de uso por coleção
 * 2. Remove transações antigas (padrão: > 90 dias)
 * 3. Remove registros de toolCalls antigos (padrão: > 90 dias)
 * 4. Remove sessões expiradas que o TTL não limpou ainda
 * 5. Remove tokens expirados
 * 6. Compacta o banco de dados (libera espaço no disco)
 */

const path = require('path');
const mongoose = require('mongoose');
require('module-alias/register');
const moduleAlias = require('module-alias');
moduleAlias.addAlias('~', path.resolve(__dirname, '..', 'api'));
const connect = require('./connect');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const daysArg = args.find((a) => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1]) : 90;

const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

function formatMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

(async () => {
  await connect();

  const db = mongoose.connection.db;
  const dbStats = await db.stats({ scale: 1024 * 1024 });

  console.log('\n====== MongoDB Stats ======');
  console.log(`Database: ${db.databaseName}`);
  console.log(`Total data size: ${formatMB(dbStats.dataSize * 1024 * 1024)}`);
  console.log(`Storage size: ${formatMB(dbStats.storageSize * 1024 * 1024)}`);
  console.log(`Index size: ${formatMB(dbStats.indexSize * 1024 * 1024)}`);
  console.log(`Total size: ${formatMB((dbStats.dataSize + dbStats.storageSize + dbStats.indexSize) * 1024 * 1024)}`);
  console.log('');

  const collections = await db.listCollections().toArray();
  const collectionStats = await Promise.all(
    collections.map(async (col) => {
      const stats = await db.collection(col.name).stats({ scale: 1024 }).catch(() => null);
      if (!stats) return null;
      return {
        name: col.name,
        count: stats.count || 0,
        sizeMB: ((stats.size || 0) / 1024).toFixed(2),
        storageMB: ((stats.storageSize || 0) / 1024).toFixed(2),
      };
    }),
  );

  console.log('====== Collections ======');
  collectionStats
    .filter(Boolean)
    .sort((a, b) => parseFloat(b.sizeMB) - parseFloat(a.sizeMB))
    .forEach((c) => {
      console.log(`  ${c.name.padEnd(25)} count=${String(c.count).padStart(8)}  size=${c.sizeMB.padStart(8)} MB  storage=${c.storageMB.padStart(8)} MB`);
    });

  if (dryRun) {
    console.log('\n[DRY RUN] Nenhuma alteração foi feita.');
    console.log(`Rodaria limpeza de dados mais antigos que ${days} dias (antes de ${cutoffDate.toISOString()})`);
    process.exit(0);
  }

  console.log(`\n====== Cleanup (> ${days} dias, antes de ${cutoffDate.toISOString()}) ======`);

  const transResult = await db.collection('transactions').deleteMany({ createdAt: { $lt: cutoffDate } });
  console.log(`  transactions deletadas: ${transResult.deletedCount}`);

  const toolCallResult = await db.collection('toolcalls').deleteMany({ createdAt: { $lt: cutoffDate } });
  console.log(`  toolcalls deletadas: ${toolCallResult.deletedCount}`);

  const sessionResult = await db.collection('sessions').deleteMany({ expiration: { $lt: new Date() } });
  console.log(`  sessions expiradas deletadas: ${sessionResult.deletedCount}`);

  const tokenResult = await db.collection('tokens').deleteMany({ expiresAt: { $lt: new Date() } });
  console.log(`  tokens expirados deletados: ${tokenResult.deletedCount}`);

  console.log('\n====== Compactando coleções ======');
  const toCompact = ['transactions', 'toolcalls', 'messages', 'conversations', 'sessions'];
  for (const colName of toCompact) {
    try {
      await db.command({ compact: colName });
      console.log(`  ${colName}: compactado`);
    } catch (e) {
      console.log(`  ${colName}: ${e.message}`);
    }
  }

  const afterStats = await db.stats({ scale: 1024 * 1024 });
  console.log('\n====== Stats Após Limpeza ======');
  console.log(`Total size: ${formatMB((afterStats.dataSize + afterStats.storageSize + afterStats.indexSize) * 1024 * 1024)}`);

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
