import { getCollection } from '../mongodb'

export interface SignupsByDay { date: string; count: number; cumulative: number }
export interface SignupsByHour { hour: number; count: number }
export interface ChurnData { week: string; newUsers: number; churnedUsers: number; netGrowth: number; churnRate: number }

export async function getSignupsPerDay(days = 30): Promise<SignupsByDay[]> {
  const col = await getCollection('users')
  const since = new Date(Date.now() - days * 86400000)
  const result = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since }, expiresAt: { $exists: false } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray()
  let cumulative = 0
  return result.map((r) => {
    cumulative += r.count
    return { date: r._id, count: r.count, cumulative }
  })
}

export async function getSignupsPerHour(days = 30): Promise<SignupsByHour[]> {
  const col = await getCollection('users')
  const since = new Date(Date.now() - days * 86400000)
  const result = await col
    .aggregate<{ _id: number; count: number }>([
      { $match: { createdAt: { $gte: since }, expiresAt: { $exists: false } } },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()
  return result.map((r) => ({ hour: r._id, count: r.count }))
}

export async function getWeeklyChurn(weeks = 8): Promise<ChurnData[]> {
  const col = await getCollection('messages')
  const users = await getCollection('users')

  const results: ChurnData[] = []
  const now = new Date()

  for (let w = weeks; w >= 1; w--) {
    const weekStart = new Date(now.getTime() - w * 7 * 86400000)
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
    const prevWeekStart = new Date(weekStart.getTime() - 7 * 86400000)

    const [newUsers, activeThisWeek, activePrevWeek] = await Promise.all([
      users.countDocuments({
        createdAt: { $gte: weekStart, $lt: weekEnd },
        expiresAt: { $exists: false },
      }),
      col.distinct('user', { createdAt: { $gte: weekStart, $lt: weekEnd }, isCreatedByUser: true }),
      col.distinct('user', {
        createdAt: { $gte: prevWeekStart, $lt: weekStart },
        isCreatedByUser: true,
      }),
    ])

    const activeThisWeekSet = new Set(activeThisWeek)
    const churnedUsers = activePrevWeek.filter((u) => !activeThisWeekSet.has(u)).length
    const churnRate =
      activePrevWeek.length > 0
        ? Math.round((churnedUsers / activePrevWeek.length) * 100)
        : 0

    results.push({
      week: weekStart.toISOString().substring(0, 10),
      newUsers,
      churnedUsers,
      netGrowth: newUsers - churnedUsers,
      churnRate,
    })
  }
  return results
}

export async function getProviderBreakdown(): Promise<Array<{ provider: string; count: number }>> {
  const col = await getCollection('users')
  const result = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { expiresAt: { $exists: false } } },
      { $group: { _id: '$provider', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray()
  return result.map((r) => ({ provider: r._id ?? 'local', count: r.count }))
}
