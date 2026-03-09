import { getCollection, getCached, setCache } from '../mongodb'

export interface DailyActive { date: string; dau: number }
export interface WeeklyActive { week: string; wau: number }
export interface MonthlyActive { month: string; mau: number }
export interface RetentionRates { d1: number; d7: number; d30: number; totalCohort: number }

export interface CohortRow {
  cohort: string
  size: number
  week0: number
  week1: number
  week2: number
  week3: number
  week4: number
  week5: number
  week6: number
  week7: number
}

async function computeDAU(days: number): Promise<DailyActive[]> {
  const col = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)
  const result = await col
    .aggregate<{ _id: { date: string; user: string } }>([
      { $match: { createdAt: { $gte: since }, isCreatedByUser: true } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            user: '$user',
          },
        },
      },
      { $group: { _id: '$_id.date', dau: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()
  return (result as unknown as Array<{ _id: string; dau: number }>).map((r) => ({
    date: r._id,
    dau: r.dau,
  }))
}

export async function getDAU(days = 30): Promise<DailyActive[]> {
  const cacheKey = `dau_${days}`
  const cached = await getCached<DailyActive[]>(cacheKey)
  if (cached) return cached
  const data = await computeDAU(days)
  await setCache(cacheKey, data)
  return data
}

export async function getWAU(weeks = 12): Promise<WeeklyActive[]> {
  const cacheKey = `wau_${weeks}`
  const cached = await getCached<WeeklyActive[]>(cacheKey)
  if (cached) return cached

  const col = await getCollection('messages')
  const since = new Date(Date.now() - weeks * 7 * 86400000)
  const result = await col
    .aggregate<{ _id: { week: string; user: string } }>([
      { $match: { createdAt: { $gte: since }, isCreatedByUser: true } },
      {
        $group: {
          _id: {
            week: {
              $dateToString: {
                format: '%Y-W%V',
                date: '$createdAt',
              },
            },
            user: '$user',
          },
        },
      },
      { $group: { _id: '$_id.week', wau: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()
  const data = (result as unknown as Array<{ _id: string; wau: number }>).map((r) => ({
    week: r._id,
    wau: r.wau,
  }))
  await setCache(cacheKey, data)
  return data
}

export async function getMAU(months = 6): Promise<MonthlyActive[]> {
  const cacheKey = `mau_${months}`
  const cached = await getCached<MonthlyActive[]>(cacheKey)
  if (cached) return cached

  const col = await getCollection('messages')
  const since = new Date(Date.now() - months * 30 * 86400000)
  const result = await col
    .aggregate<{ _id: { month: string; user: string } }>([
      { $match: { createdAt: { $gte: since }, isCreatedByUser: true } },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            user: '$user',
          },
        },
      },
      { $group: { _id: '$_id.month', mau: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()
  const data = (result as unknown as Array<{ _id: string; mau: number }>).map((r) => ({
    month: r._id,
    mau: r.mau,
  }))
  await setCache(cacheKey, data)
  return data
}

export async function getRetentionRates(): Promise<RetentionRates> {
  const cacheKey = 'retention_d1d7d30'
  const cached = await getCached<RetentionRates>(cacheKey)
  if (cached) return cached

  const users = await getCollection('users')
  const messages = await getCollection('messages')

  // Users who signed up 30+ days ago
  const thirtyOneDaysAgo = new Date(Date.now() - 31 * 86400000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const oneDayAgo = new Date(Date.now() - 86400000)

  const cohortUsers = await users
    .find(
      { createdAt: { $lte: thirtyOneDaysAgo }, expiresAt: { $exists: false } },
      { projection: { _id: 1, createdAt: 1 } }
    )
    .toArray()

  if (cohortUsers.length === 0) {
    return { d1: 0, d7: 0, d30: 0, totalCohort: 0 }
  }

  const userIds = cohortUsers.map((u) => String(u._id))

  const [d1Users, d7Users, d30Users] = await Promise.all([
    messages
      .distinct('user', {
        user: { $in: userIds },
        createdAt: {
          $gte: new Date(thirtyOneDaysAgo.getTime() + 86400000),
          $lte: new Date(thirtyOneDaysAgo.getTime() + 2 * 86400000),
        },
      })
      .then((r) => r.length),
    messages
      .distinct('user', {
        user: { $in: userIds },
        createdAt: {
          $gte: new Date(thirtyOneDaysAgo.getTime() + 7 * 86400000),
          $lte: new Date(thirtyOneDaysAgo.getTime() + 8 * 86400000),
        },
      })
      .then((r) => r.length),
    messages
      .distinct('user', {
        user: { $in: userIds },
        createdAt: {
          $gte: new Date(thirtyOneDaysAgo.getTime() + 30 * 86400000),
          $lte: new Date(thirtyOneDaysAgo.getTime() + 31 * 86400000),
        },
      })
      .then((r) => r.length),
  ])

  const total = cohortUsers.length
  const data: RetentionRates = {
    d1: Math.round((d1Users / total) * 100),
    d7: Math.round((d7Users / total) * 100),
    d30: Math.round((d30Users / total) * 100),
    totalCohort: total,
  }
  await setCache(cacheKey, data)
  return data
}

export async function getCohortAnalysis(): Promise<CohortRow[]> {
  const cacheKey = 'cohort_weekly'
  const cached = await getCached<CohortRow[]>(cacheKey)
  if (cached) return cached

  const usersCol = await getCollection('users')
  const messagesCol = await getCollection('messages')

  // Get all users with their signup week (last 8 weeks)
  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 86400000)
  const cohortUsers = await usersCol
    .find(
      { createdAt: { $gte: eightWeeksAgo }, expiresAt: { $exists: false } },
      { projection: { _id: 1, createdAt: 1 } }
    )
    .toArray()

  // Group users by signup week
  const cohortMap: Record<string, { users: string[]; weekStart: Date }> = {}
  for (const user of cohortUsers) {
    const weekStart = new Date(user.createdAt)
    weekStart.setUTCHours(0, 0, 0, 0)
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay())
    const weekKey = weekStart.toISOString().substring(0, 10)
    if (!cohortMap[weekKey]) cohortMap[weekKey] = { users: [], weekStart }
    cohortMap[weekKey].users.push(user._id.toString())
  }

  const rows: CohortRow[] = []
  for (const [weekKey, { users: cohortUserIds, weekStart }] of Object.entries(cohortMap).sort()) {
    if (cohortUserIds.length === 0) continue
    const weekCounts: number[] = []
    for (let w = 0; w <= 7; w++) {
      const weekFrom = new Date(weekStart.getTime() + w * 7 * 86400000)
      const weekTo = new Date(weekFrom.getTime() + 7 * 86400000)
      if (weekFrom > new Date()) {
        weekCounts.push(-1)
        continue
      }
      const activeUsers = await messagesCol
        .distinct('user', {
          user: { $in: cohortUserIds },
          createdAt: { $gte: weekFrom, $lt: weekTo },
        })
        .then((r) => r.length)
      weekCounts.push(Math.round((activeUsers / cohortUserIds.length) * 100))
    }
    rows.push({
      cohort: weekKey,
      size: cohortUserIds.length,
      week0: weekCounts[0] ?? 0,
      week1: weekCounts[1] ?? -1,
      week2: weekCounts[2] ?? -1,
      week3: weekCounts[3] ?? -1,
      week4: weekCounts[4] ?? -1,
      week5: weekCounts[5] ?? -1,
      week6: weekCounts[6] ?? -1,
      week7: weekCounts[7] ?? -1,
    })
  }

  await setCache(cacheKey, rows)
  return rows
}

export interface EngagementStats {
  avgSessionsPerUserPerDay: number
  avgMessagesPerUserPerDay: number
  usersAtDailyLimit: number
  usersAtDailyLimitPct: number
}

export async function getEngagementStats(days = 7): Promise<EngagementStats> {
  const cacheKey = `engagement_${days}`
  const cached = await getCached<EngagementStats>(cacheKey)
  if (cached) return cached

  const messages = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)

  // Avg messages per user per day
  const perUserPerDay = await messages
    .aggregate<{ _id: { date: string; user: string }; count: number }>([
      { $match: { createdAt: { $gte: since }, isCreatedByUser: true } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            user: '$user',
          },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray()

  const avgMessages =
    perUserPerDay.length > 0
      ? perUserPerDay.reduce((s, r) => s + r.count, 0) / perUserPerDay.length
      : 0

  // Users who hit 50+ messages in a day (proxy for daily limit)
  const heavyUsers = perUserPerDay.filter((r) => r.count >= 50)
  const totalDayUsers = new Set(perUserPerDay.map((r) => r._id.user)).size

  const data: EngagementStats = {
    avgSessionsPerUserPerDay: 1,
    avgMessagesPerUserPerDay: Math.round(avgMessages * 10) / 10,
    usersAtDailyLimit: heavyUsers.length,
    usersAtDailyLimitPct:
      totalDayUsers > 0 ? Math.round((heavyUsers.length / totalDayUsers) * 100) : 0,
  }
  await setCache(cacheKey, data)
  return data
}
