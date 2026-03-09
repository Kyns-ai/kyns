import { getCollection, getCached, setCache } from '../mongodb'

export interface QualityMetrics {
  errorRateToday: number
  errorRateLast7d: number
  thinkingLeaksLast7d: number
  avgResponseTimeMs: number
  timeoutRateLast7d: number
}

export interface DailyErrorRate { date: string; errorRate: number; total: number; errors: number }

export async function getQualityMetrics(): Promise<QualityMetrics> {
  const col = await getCollection('messages')
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)

  const [totalToday, errorsToday, totalWeek, errorsWeek, thinkingLeaks] = await Promise.all([
    col.countDocuments({ createdAt: { $gte: todayStart }, isCreatedByUser: false }),
    col.countDocuments({ createdAt: { $gte: todayStart }, error: true }),
    col.countDocuments({ createdAt: { $gte: sevenDaysAgo }, isCreatedByUser: false }),
    col.countDocuments({ createdAt: { $gte: sevenDaysAgo }, error: true }),
    col.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
      isCreatedByUser: false,
      $or: [
        { text: { $regex: '<think>', $options: 'i' } },
        { text: { $regex: 'Thinking Process:', $options: 'i' } },
        { text: { $regex: '<\\/think>', $options: 'i' } },
      ],
    }),
  ])

  return {
    errorRateToday: totalToday > 0 ? Math.round((errorsToday / totalToday) * 100) : 0,
    errorRateLast7d: totalWeek > 0 ? Math.round((errorsWeek / totalWeek) * 100) : 0,
    thinkingLeaksLast7d: thinkingLeaks,
    avgResponseTimeMs: 0,
    timeoutRateLast7d: 0,
  }
}

export async function getDailyErrorRate(days = 14): Promise<DailyErrorRate[]> {
  const cacheKey = `daily_error_rate_${days}`
  const cached = await getCached<DailyErrorRate[]>(cacheKey)
  if (cached) return cached

  const col = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)

  const result = await col
    .aggregate<{ _id: { date: string; isError: boolean }; count: number }>([
      { $match: { createdAt: { $gte: since }, isCreatedByUser: false } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            isError: { $ifNull: ['$error', false] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ])
    .toArray()

  const dateMap: Record<string, { total: number; errors: number }> = {}
  for (const r of result) {
    const { date, isError } = r._id
    if (!dateMap[date]) dateMap[date] = { total: 0, errors: 0 }
    dateMap[date].total += r.count
    if (isError) dateMap[date].errors += r.count
  }

  const data = Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      total: v.total,
      errors: v.errors,
      errorRate: v.total > 0 ? Math.round((v.errors / v.total) * 100 * 10) / 10 : 0,
    }))

  await setCache(cacheKey, data)
  return data
}

export async function getThinkingLeakSamples(limit = 5): Promise<Array<{ text: string; date: Date }>> {
  const col = await getCollection('messages')
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const samples = await col
    .find(
      {
        createdAt: { $gte: sevenDaysAgo },
        isCreatedByUser: false,
        $or: [
          { text: { $regex: '<think>', $options: 'i' } },
          { text: { $regex: 'Thinking Process:', $options: 'i' } },
        ],
      },
      { projection: { text: 1, createdAt: 1 } }
    )
    .limit(limit)
    .toArray()

  return samples.map((s) => ({
    text: (s.text as string ?? '').substring(0, 200) + '...',
    date: s.createdAt as Date,
  }))
}

export interface LoopingDetection { date: string; count: number }

export async function getLoopingMessages(days = 7): Promise<number> {
  const col = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)

  const count = await col.countDocuments({
    createdAt: { $gte: since },
    isCreatedByUser: false,
    $where: function () {
      const text = this.text || ''
      if (text.length < 100) return false
      const half = Math.floor(text.length / 2)
      const firstHalf = text.substring(0, half)
      const secondHalf = text.substring(half)
      return secondHalf.includes(firstHalf.substring(0, 50))
    },
  }).catch(() => 0)

  return count
}
