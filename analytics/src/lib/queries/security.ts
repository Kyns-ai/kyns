import { getCollection, getCached, setCache } from '../mongodb'
import { subDays, startOfDay, startOfHour } from 'date-fns'

export interface ViolationRecord {
  _id: string
  userId: string
  type: string
  score: number
  violationCount: number
  ip: string | null
  userAgent: string | null
  createdAt: Date
}

export interface SecurityOverview {
  totalViolations24h: number
  totalViolations7d: number
  uniqueUsers24h: number
  uniqueIPs24h: number
  topTypes: Array<{ type: string; count: number }>
  violationsPerHour: Array<{ hour: string; count: number }>
  topOffenders: Array<{ userId: string; count: number; types: string[] }>
  recentViolations: ViolationRecord[]
  suspiciousRegistrations: Array<{ date: string; count: number }>
  bannedUsers: number
}

export async function getSecurityOverview(days = 7): Promise<SecurityOverview> {
  const cacheKey = `security_overview_${days}`
  const cached = await getCached<SecurityOverview>(cacheKey)
  if (cached) return cached

  const violations = await getCollection('kyns_violations')
  const users = await getCollection('users')

  const now = new Date()
  const since24h = new Date(now.getTime() - 24 * 3600_000)
  const since7d = subDays(startOfDay(now), days)

  const [
    total24h,
    total7d,
    typeBreakdown,
    hourlyViolations,
    offenders,
    recentDocs,
    regSpikes,
    bans,
  ] = await Promise.all([
    violations.countDocuments({ createdAt: { $gte: since24h } }),
    violations.countDocuments({ createdAt: { $gte: since7d } }),
    violations
      .aggregate<{ _id: string; count: number }>([
        { $match: { createdAt: { $gte: since7d } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ])
      .toArray(),
    violations
      .aggregate<{ _id: string; count: number }>([
        { $match: { createdAt: { $gte: since24h } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%dT%H:00', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    violations
      .aggregate<{ _id: string; count: number; types: string[] }>([
        { $match: { createdAt: { $gte: since7d } } },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
            types: { $addToSet: '$type' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ])
      .toArray(),
    violations.find({ createdAt: { $gte: since7d } }).sort({ createdAt: -1 }).limit(100).toArray(),
    users
      .aggregate<{ _id: string; count: number }>([
        { $match: { createdAt: { $gte: since7d }, expiresAt: { $exists: false } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    users.countDocuments({ banned: true }),
  ])

  const uniqueUsers = new Set(recentDocs.filter((d) => {
    const doc = d as Record<string, unknown>
    return (doc.createdAt as Date) >= since24h
  }).map((d) => (d as Record<string, unknown>).userId as string))

  const uniqueIPs = new Set(recentDocs.filter((d) => {
    const doc = d as Record<string, unknown>
    return (doc.createdAt as Date) >= since24h && doc.ip
  }).map((d) => (d as Record<string, unknown>).ip as string))

  const data: SecurityOverview = {
    totalViolations24h: total24h,
    totalViolations7d: total7d,
    uniqueUsers24h: uniqueUsers.size,
    uniqueIPs24h: uniqueIPs.size,
    topTypes: typeBreakdown.map((t) => ({ type: t._id, count: t.count })),
    violationsPerHour: hourlyViolations.map((h) => ({ hour: h._id, count: h.count })),
    topOffenders: offenders.map((o) => ({ userId: o._id, count: o.count, types: o.types })),
    recentViolations: recentDocs.map((d) => {
      const doc = d as Record<string, unknown>
      return {
        _id: String(d._id),
        userId: String(doc.userId ?? ''),
        type: String(doc.type ?? ''),
        score: Number(doc.score ?? 1),
        violationCount: Number(doc.violationCount ?? 0),
        ip: doc.ip ? String(doc.ip) : null,
        userAgent: doc.userAgent ? String(doc.userAgent) : null,
        createdAt: (doc.createdAt as Date) ?? new Date(),
      }
    }),
    suspiciousRegistrations: regSpikes.map((r) => ({ date: r._id, count: r.count })),
    bannedUsers: bans,
  }

  await setCache(cacheKey, data)
  return data
}

export async function getViolationsPaginated(opts: {
  type?: string
  userId?: string
  limit?: number
  page?: number
}): Promise<{ violations: ViolationRecord[]; total: number }> {
  const col = await getCollection('kyns_violations')
  const limit = Math.min(opts.limit ?? 50, 200)
  const page = opts.page ?? 1
  const skip = (page - 1) * limit

  const match: Record<string, unknown> = {}
  if (opts.type) match['type'] = opts.type
  if (opts.userId) match['userId'] = { $regex: opts.userId, $options: 'i' }

  const [docs, total] = await Promise.all([
    col.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(match),
  ])

  const violations: ViolationRecord[] = docs.map((d) => {
    const doc = d as Record<string, unknown>
    return {
      _id: String(d._id),
      userId: String(doc.userId ?? ''),
      type: String(doc.type ?? ''),
      score: Number(doc.score ?? 1),
      violationCount: Number(doc.violationCount ?? 0),
      ip: doc.ip ? String(doc.ip) : null,
      userAgent: doc.userAgent ? String(doc.userAgent) : null,
      createdAt: (doc.createdAt as Date) ?? new Date(),
    }
  })

  return { violations, total }
}
