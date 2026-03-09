import { MongoClient, Db, Collection, type Document } from 'mongodb'

declare global {
  var _mongoClient: MongoClient | undefined
}

let client: MongoClient
let db: Db

export async function getDb(): Promise<Db> {
  if (db) return db

  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')

  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    })
    await global._mongoClient.connect()
  }

  client = global._mongoClient
  db = client.db(process.env.MONGODB_DB_NAME ?? 'LibreChat')
  return db
}

export async function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const database = await getDb()
  return database.collection<T>(name)
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
      { expireAfterSeconds: 3600 }
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
