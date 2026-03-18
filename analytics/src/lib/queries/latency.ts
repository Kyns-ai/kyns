import { getCollection, getCached, setCache } from '../mongodb'
import { subDays, startOfDay } from 'date-fns'

export interface LatencyOverview {
  p50: number
  p95: number
  p99: number
  avgMs: number
  totalRequests: number
  latencyOverTime: Array<{ hour: string; p50: number; p95: number; avg: number }>
  byEndpoint: Array<{ endpoint: string; avgMs: number; p95: number; count: number }>
  slowestRequests: Array<{
    path: string
    method: string
    durationMs: number
    statusCode: number
    userId: string | null
    createdAt: Date
  }>
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

export async function getLatencyOverview(days = 1): Promise<LatencyOverview> {
  const cacheKey = `latency_overview_${days}`
  const cached = await getCached<LatencyOverview>(cacheKey)
  if (cached) return cached

  const col = await getCollection('kyns_response_times')
  const since = subDays(startOfDay(new Date()), days)

  const [docs, hourlyAgg, endpointAgg, slowest] = await Promise.all([
    col.find({ createdAt: { $gte: since } }).project({ durationMs: 1 }).toArray(),
    col
      .aggregate<{ _id: string; avg: number; values: number[] }>([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%dT%H:00', date: '$createdAt' } },
            avg: { $avg: '$durationMs' },
            values: { $push: '$durationMs' },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    col
      .aggregate<{ _id: string; avg: number; count: number; values: number[] }>([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$path',
            avg: { $avg: '$durationMs' },
            count: { $sum: 1 },
            values: { $push: '$durationMs' },
          },
        },
        { $sort: { avg: -1 } },
        { $limit: 15 },
      ])
      .toArray(),
    col.find({ createdAt: { $gte: since } }).sort({ durationMs: -1 }).limit(20).toArray(),
  ])

  const allDurations = docs.map((d) => Number((d as Record<string, unknown>).durationMs ?? 0)).sort((a, b) => a - b)
  const total = allDurations.length
  const avg = total > 0 ? Math.round(allDurations.reduce((s, v) => s + v, 0) / total) : 0

  const data: LatencyOverview = {
    p50: percentile(allDurations, 50),
    p95: percentile(allDurations, 95),
    p99: percentile(allDurations, 99),
    avgMs: avg,
    totalRequests: total,
    latencyOverTime: hourlyAgg.map((h) => {
      const sorted = (h.values ?? []).sort((a: number, b: number) => a - b)
      return {
        hour: h._id,
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        avg: Math.round(h.avg),
      }
    }),
    byEndpoint: endpointAgg.map((e) => {
      const sorted = (e.values ?? []).sort((a: number, b: number) => a - b)
      return {
        endpoint: e._id,
        avgMs: Math.round(e.avg),
        p95: percentile(sorted, 95),
        count: e.count,
      }
    }),
    slowestRequests: slowest.map((d) => {
      const doc = d as Record<string, unknown>
      return {
        path: String(doc.path ?? ''),
        method: String(doc.method ?? ''),
        durationMs: Number(doc.durationMs ?? 0),
        statusCode: Number(doc.statusCode ?? 0),
        userId: doc.userId ? String(doc.userId) : null,
        createdAt: (doc.createdAt as Date) ?? new Date(),
      }
    }),
  }

  await setCache(cacheKey, data)
  return data
}
