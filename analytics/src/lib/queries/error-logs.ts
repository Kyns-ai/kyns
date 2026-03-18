import { getCollection } from '../mongodb'

export interface SystemErrorLog {
  _id: string
  source: string
  level: string
  message: string
  stack: string | null
  metadata: Record<string, unknown> | null
  httpStatus: number | null
  httpMethod: string | null
  path: string | null
  userId: string | null
  createdAt: Date
}

export interface ErrorLogStats {
  totalLast24h: number
  bySource: Record<string, number>
  byLevel: Record<string, number>
  hourlyTrend: Array<{ hour: string; count: number }>
}

export async function getSystemErrorLogs(opts: {
  source?: string
  level?: string
  search?: string
  limit?: number
  page?: number
}): Promise<{ logs: SystemErrorLog[]; total: number }> {
  const col = await getCollection('kyns_error_logs')
  const limit = Math.min(opts.limit ?? 50, 200)
  const page = opts.page ?? 1
  const skip = (page - 1) * limit

  const match: Record<string, unknown> = {}
  if (opts.source) match['source'] = opts.source
  if (opts.level) match['level'] = opts.level
  if (opts.search) {
    match['message'] = { $regex: opts.search, $options: 'i' }
  }

  const [docs, total] = await Promise.all([
    col.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(match),
  ])

  const logs: SystemErrorLog[] = docs.map((d) => {
    const doc = d as Record<string, unknown>
    return {
      _id: String(d._id),
      source: String(doc.source ?? 'unknown'),
      level: String(doc.level ?? 'error'),
      message: String(doc.message ?? ''),
      stack: typeof doc.stack === 'string' ? doc.stack : null,
      metadata: (doc.metadata as Record<string, unknown>) ?? null,
      httpStatus: typeof doc.httpStatus === 'number' ? doc.httpStatus : null,
      httpMethod: typeof doc.httpMethod === 'string' ? doc.httpMethod : null,
      path: typeof doc.path === 'string' ? doc.path : null,
      userId: typeof doc.userId === 'string' ? doc.userId : null,
      createdAt: (doc.createdAt as Date) ?? new Date(),
    }
  })

  return { logs, total }
}

export async function getErrorLogStats(): Promise<ErrorLogStats> {
  const col = await getCollection('kyns_error_logs')
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [totalLast24h, sourceAgg, levelAgg, hourlyAgg] = await Promise.all([
    col.countDocuments({ createdAt: { $gte: since } }),
    col.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]).toArray(),
    col.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]).toArray(),
    col.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%dT%H:00', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).toArray(),
  ])

  const bySource: Record<string, number> = {}
  for (const s of sourceAgg) bySource[String(s._id)] = s.count as number

  const byLevel: Record<string, number> = {}
  for (const l of levelAgg) byLevel[String(l._id)] = l.count as number

  const hourlyTrend = hourlyAgg.map((h) => ({
    hour: String(h._id),
    count: h.count as number,
  }))

  return { totalLast24h, bySource, byLevel, hourlyTrend }
}
