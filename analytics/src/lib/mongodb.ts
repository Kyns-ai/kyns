import { MongoClient, MongoTopologyClosedError, Db, Collection, type Document } from 'mongodb'

declare global {
  var _mongoClient: MongoClient | undefined
}

async function createClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  const c = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  })
  await c.connect()
  return c
}

async function getClient(): Promise<MongoClient> {
  if (!global._mongoClient) {
    global._mongoClient = await createClient()
  }
  return global._mongoClient
}

async function resetClient(): Promise<MongoClient> {
  if (global._mongoClient) {
    try { await global._mongoClient.close() } catch { /* ignore */ }
    global._mongoClient = undefined
  }
  global._mongoClient = await createClient()
  return global._mongoClient
}

export async function getDb(): Promise<Db> {
  const c = await getClient()
  return c.db(process.env.MONGODB_DB_NAME ?? 'LibreChat')
}

export async function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  try {
    const database = await getDb()
    return database.collection<T>(name)
  } catch (e) {
    if (e instanceof MongoTopologyClosedError) {
      const c = await resetClient()
      return c.db(process.env.MONGODB_DB_NAME ?? 'LibreChat').collection<T>(name)
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
    database.collection('conversations').createIndex({ user: 1, createdAt: 1 }),
    database.collection('conversations').createIndex({ endpoint: 1, createdAt: 1 }),
    database.collection('transactions').createIndex({ user: 1, createdAt: 1 }),
    database.collection('transactions').createIndex({ tokenType: 1, createdAt: 1 }),
    database.collection('kyns_analytics_cache').createIndex({ key: 1 }, { unique: true }),
    database.collection('kyns_analytics_cache').createIndex(
      { updatedAt: 1 },
      { expireAfterSeconds: 300 }
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

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof MongoTopologyClosedError) {
      await resetClient()
      return fn()
    }
    throw e
  }
}
