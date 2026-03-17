import { getDb } from '../mongodb'

export interface EndpointStatus {
  name: string
  url: string
  status: 'online' | 'offline' | 'unknown'
  latencyMs: number | null
  lastChecked: Date
  error?: string
}

export interface MongoStats {
  connections: { current: number; available: number }
  dataSize: number
  storageSize: number
  collections: number
  objects: number
  uptime: number
}

async function pingEndpoint(name: string, url: string, timeoutMs = 8000): Promise<EndpointStatus> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { signal: controller.signal, method: 'GET' })
    clearTimeout(timer)
    const latencyMs = Date.now() - start
    return {
      name,
      url,
      status: res.ok || res.status < 500 ? 'online' : 'offline',
      latencyMs,
      lastChecked: new Date(),
    }
  } catch (err) {
    return {
      name,
      url,
      status: 'offline',
      latencyMs: null,
      lastChecked: new Date(),
      error: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}

export async function getInfrastructureStatus() {
  const endpoints: Array<{ name: string; url: string }> = []

  if (process.env.VLLM_API_URL) {
    endpoints.push({ name: 'vLLM (RunPod Text)', url: `${process.env.VLLM_API_URL}/health` })
  }
  if (process.env.IMAGE_API_URL) {
    endpoints.push({ name: 'Image API (RunPod)', url: `${process.env.IMAGE_API_URL}/health` })
  }
  if (process.env.LIBRECHAT_URL || process.env.RAILWAY_SERVICE_LIBRECHAT_URL) {
    const lcUrl = process.env.LIBRECHAT_URL ?? `https://${process.env.RAILWAY_SERVICE_LIBRECHAT_URL}`
    endpoints.push({ name: 'LibreChat (Railway)', url: `${lcUrl}/api/health` })
  }
  if (process.env.SEARXNG_URL || process.env.RAILWAY_SERVICE_SEARXNG_URL) {
    const sUrl = process.env.SEARXNG_URL ?? `https://${process.env.RAILWAY_SERVICE_SEARXNG_URL}`
    endpoints.push({ name: 'SearXNG', url: `${sUrl}/healthz` })
  }

  const statuses = await Promise.all(endpoints.map((e) => pingEndpoint(e.name, e.url)))
  const mongoStats = await getMongoStats()

  return { endpoints: statuses, mongo: mongoStats }
}

export async function getMongoStats(): Promise<MongoStats | null> {
  try {
    const db = await getDb()
    const stats = await db.command({ serverStatus: 1, repl: 0, metrics: 0, locks: 0 })
    const dbStats = await db.stats()
    return {
      connections: {
        current: stats.connections?.current ?? 0,
        available: stats.connections?.available ?? 0,
      },
      dataSize: dbStats.dataSize ?? 0,
      storageSize: dbStats.storageSize ?? 0,
      collections: dbStats.collections ?? 0,
      objects: dbStats.objects ?? 0,
      uptime: stats.uptimeSeconds ?? 0,
    }
  } catch {
    return null
  }
}

export async function getUptimeHistory(days = 7) {
  const db = await getDb()
  const col = db.collection<{ ts: Date; endpoint: string; up: boolean; latencyMs: number | null }>('kyns_uptime_log')
  const since = new Date(Date.now() - days * 86400_000)
  const docs = await col.find({ ts: { $gte: since } }).sort({ ts: 1 }).toArray()
  return docs
}

export async function logUptimeCheck(endpoint: string, up: boolean, latencyMs: number | null) {
  const db = await getDb()
  const col = db.collection('kyns_uptime_log')
  await col.insertOne({ ts: new Date(), endpoint, up, latencyMs })
  const cutoff = new Date(Date.now() - 30 * 86400_000)
  await col.deleteMany({ ts: { $lt: cutoff } })
}
