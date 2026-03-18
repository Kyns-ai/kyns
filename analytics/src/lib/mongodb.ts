import { MongoClient, Db, Collection, type Document } from 'mongodb'

let _client: MongoClient | undefined

function isTopologyClosedError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const err = e as { name?: string; message?: string }
  return err.name === 'MongoTopologyClosedError' ||
    (typeof err.message === 'string' && err.message.includes('Topology is closed'))
}

async function createClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  const c = new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 30000,
    heartbeatFrequencyMS: 30000,
    minHeartbeatFrequencyMS: 10000,
  })
  await c.connect()
  return c
}

export async function connectDb(): Promise<Db> {
  if (_client) {
    try { await _client.close() } catch { /* ignore */ }
    _client = undefined
  }
  _client = await createClient()
  return _client.db(process.env.MONGODB_DB_NAME ?? 'LibreChat')
}

export async function getDb(): Promise<Db> {
  if (!_client) {
    _client = await createClient()
  }
  return _client.db(process.env.MONGODB_DB_NAME ?? 'LibreChat')
}

export async function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const database = await getDb()
  return database.collection<T>(name)
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (isTopologyClosedError(e)) {
      console.log('[MongoDB] Topology closed, resetting connection...')
      if (_client) {
        try { await _client.close() } catch { /* ignore */ }
        _client = undefined
      }
      _client = await createClient()
      return fn()
    }
    throw e
  }
}

export async function ensureIndexes(): Promise<void> {
  const database = await getDb()
  await Promise.all([
    database.collection('messages').createIndex({ createdAt: 1 }),
    database.collection('messages').createIndex({ user: 1, createdAt: 1 }),
    database.collection('messages').createIndex({ endpoint: 1, createdAt: 1 }),
    database.collection('messages').createIndex({ error: 1, isCreatedByUser: 1, createdAt: -1 }),
    database.collection('conversations').createIndex({ user: 1, createdAt: 1 }),
    database.collection('conversations').createIndex({ endpoint: 1, createdAt: 1 }),
    database.collection('transactions').createIndex({ user: 1, createdAt: 1 }),
    database.collection('transactions').createIndex({ tokenType: 1, createdAt: 1 }),
    database.collection('kyns_analytics_cache').createIndex({ key: 1 }, { unique: true }),
    database.collection('kyns_analytics_cache').createIndex(
      { updatedAt: 1 },
      { expireAfterSeconds: 300 }
    ),
    database.collection('kyns_violations').createIndex({ createdAt: -1 }),
    database.collection('kyns_violations').createIndex({ type: 1, createdAt: -1 }),
    database.collection('kyns_violations').createIndex({ userId: 1, createdAt: -1 }),
    database.collection('kyns_response_times').createIndex({ createdAt: -1 }),
    database.collection('kyns_response_times').createIndex({ path: 1, createdAt: -1 }),
    database.collection('kyns_response_times').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 30 * 86400 }
    ),
    database.collection('kyns_audit_log').createIndex({ createdAt: -1 }),
    database.collection('kyns_audit_log').createIndex({ action: 1, createdAt: -1 }),
    database.collection('kyns_error_logs').createIndex({ createdAt: -1 }),
    database.collection('kyns_error_logs').createIndex({ source: 1, createdAt: -1 }),
    database.collection('kyns_error_logs').createIndex({ level: 1, createdAt: -1 }),
    database.collection('kyns_error_logs').createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 30 * 86400 }
    ),
  ])
}

export async function getCached<T>(key: string): Promise<T | null> {
  const database = await getDb()
  const doc = await database
    .collection<{ key: string; data: T; updatedAt: Date }>('kyns_analytics_cache')
    .findOne({ key })
  if (!doc) return null
  const age = Date.now() - doc.updatedAt.getTime()
  if (age > 5 * 60 * 1000) return null
  return doc.data
}

export async function setCache(key: string, data: unknown): Promise<void> {
  const database = await getDb()
  await database
    .collection('kyns_analytics_cache')
    .updateOne(
      { key },
      { $set: { data, updatedAt: new Date() } },
      { upsert: true }
    )
}
