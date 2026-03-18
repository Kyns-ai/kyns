import { getCollection, getCached, setCache } from '../mongodb'
import type { MongoUser } from '../types'

export interface FunnelStep {
  step: string
  label: string
  count: number
  pct: number
}

export interface TimeToFirstMessage {
  bucket: string
  count: number
}

export async function getActivationFunnel(days = 30): Promise<FunnelStep[]> {
  const cacheKey = `funnel_${days}`
  const cached = await getCached<FunnelStep[]>(cacheKey)
  if (cached) return cached

  const users = await getCollection<MongoUser>('users')
  const messages = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)

  const signups = await users
    .find({ createdAt: { $gte: since }, expiresAt: { $exists: false } }, { projection: { _id: 1, createdAt: 1 } })
    .toArray()

  const total = signups.length
  if (total === 0) {
    await setCache(cacheKey, [])
    return []
  }

  const userIds = signups.map((u) => String(u._id))

  const [sent1, sent5, returnedD1, returnedD7] = await Promise.all([
    messages.distinct('user', { user: { $in: userIds }, isCreatedByUser: true }).then((r) => r.length),
    messages
      .aggregate<{ _id: string; count: number }>([
        { $match: { user: { $in: userIds }, isCreatedByUser: true } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
        { $match: { count: { $gte: 5 } } },
      ])
      .toArray()
      .then((r) => r.length),
    Promise.all(
      signups.slice(0, 1000).map(async (u) => {
        const d1Start = new Date(u.createdAt.getTime() + 86400000)
        const d1End = new Date(d1Start.getTime() + 86400000)
        const count = await messages.countDocuments({
          user: String(u._id),
          createdAt: { $gte: d1Start, $lte: d1End },
          isCreatedByUser: true,
        })
        return count > 0 ? 1 : 0
      })
    ).then((r) => r.reduce((s: number, v) => s + v, 0)),
    Promise.all(
      signups.slice(0, 1000).map(async (u) => {
        const d7Start = new Date(u.createdAt.getTime() + 7 * 86400000)
        const d7End = new Date(d7Start.getTime() + 86400000)
        const count = await messages.countDocuments({
          user: String(u._id),
          createdAt: { $gte: d7Start, $lte: d7End },
          isCreatedByUser: true,
        })
        return count > 0 ? 1 : 0
      })
    ).then((r) => r.reduce((s: number, v) => s + v, 0)),
  ])

  const steps: FunnelStep[] = [
    { step: 'signup', label: 'Criou conta', count: total, pct: 100 },
    { step: 'first_message', label: 'Enviou 1ª mensagem', count: sent1, pct: Math.round((sent1 / total) * 100) },
    { step: 'fifth_message', label: 'Enviou 5ª mensagem', count: sent5, pct: Math.round((sent5 / total) * 100) },
    { step: 'returned_d1', label: 'Voltou no D+1', count: returnedD1, pct: Math.round((returnedD1 / total) * 100) },
    { step: 'returned_d7', label: 'Voltou na semana', count: returnedD7, pct: Math.round((returnedD7 / total) * 100) },
  ]

  await setCache(cacheKey, steps)
  return steps
}

export async function getTimeToFirstMessage(): Promise<TimeToFirstMessage[]> {
  const cacheKey = 'time_to_first_message'
  const cached = await getCached<TimeToFirstMessage[]>(cacheKey)
  if (cached) return cached

  const users = await getCollection<MongoUser>('users')
  const messages = await getCollection('messages')
  const since = new Date(Date.now() - 30 * 86400000)

  const newUsers = await users
    .find({ createdAt: { $gte: since }, expiresAt: { $exists: false } }, { projection: { _id: 1, createdAt: 1 } })
    .limit(500)
    .toArray()

  const buckets: Record<string, number> = {
    '<5min': 0, '5-30min': 0, '30min-2h': 0, '2-24h': 0, '1-7d': 0, '7d+': 0, never: 0,
  }

  await Promise.all(
    newUsers.map(async (user) => {
      const firstMsg = await messages.findOne(
        { user: String(user._id), isCreatedByUser: true },
        { projection: { createdAt: 1 }, sort: { createdAt: 1 } }
      )
      if (!firstMsg) { buckets['never']++; return }
      const diffMs = (firstMsg.createdAt as Date).getTime() - (user.createdAt as Date).getTime()
      if (diffMs < 5 * 60 * 1000) buckets['<5min']++
      else if (diffMs < 30 * 60 * 1000) buckets['5-30min']++
      else if (diffMs < 2 * 3600 * 1000) buckets['30min-2h']++
      else if (diffMs < 24 * 3600 * 1000) buckets['2-24h']++
      else if (diffMs < 7 * 86400 * 1000) buckets['1-7d']++
      else buckets['7d+']++
    })
  )

  const data = Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }))
  await setCache(cacheKey, data)
  return data
}

export async function getActivationRate(days = 30): Promise<{ signups: number; activated: number; rate: number }> {
  const users = await getCollection<MongoUser>('users')
  const messages = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)

  const newUsers = await users
    .find({ createdAt: { $gte: since }, expiresAt: { $exists: false } }, { projection: { _id: 1 } })
    .toArray()

  const total = newUsers.length
  if (total === 0) return { signups: 0, activated: 0, rate: 0 }

  const userIds = newUsers.map((u) => String(u._id))
  const activated = await messages.distinct('user', { user: { $in: userIds }, isCreatedByUser: true }).then((r) => r.length)

  return { signups: total, activated, rate: Math.round((activated / total) * 100) }
}
