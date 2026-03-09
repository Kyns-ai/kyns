import { getCollection, getCached, setCache } from '../mongodb'

export interface DailyCost {
  date: string
  inputTokens: number
  outputTokens: number
  costUSD: number
}

export interface CostSummary {
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUSD: number
  costPerActiveUser: number
  costPerMessage: number
  projectedMonthlyUSD: number
  avgDailyActiveUsers: number
  avgDailyMessages: number
}

export interface CostByEndpoint {
  endpoint: string
  inputTokens: number
  outputTokens: number
  costUSD: number
  percent: number
}

function calcCost(inputTokens: number, outputTokens: number): number {
  const inCost = parseFloat(process.env.COST_PER_INPUT_TOKEN ?? '0.000001')
  const outCost = parseFloat(process.env.COST_PER_OUTPUT_TOKEN ?? '0.000003')
  return inputTokens * inCost + outputTokens * outCost
}

export async function getCostPerDay(days = 30): Promise<DailyCost[]> {
  const col = await getCollection('transactions')
  const since = new Date(Date.now() - days * 86400000)

  const result = await col
    .aggregate<{ _id: { date: string; type: string }; total: number }>([
      { $match: { createdAt: { $gte: since }, tokenType: { $in: ['prompt', 'completion'] } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            type: '$tokenType',
          },
          total: { $sum: { $abs: '$rawAmount' } },
        },
      },
      { $sort: { '_id.date': 1 } },
    ])
    .toArray()

  const map: Record<string, { inputTokens: number; outputTokens: number }> = {}
  for (const r of result) {
    const { date, type } = r._id
    if (!map[date]) map[date] = { inputTokens: 0, outputTokens: 0 }
    if (type === 'prompt') map[date].inputTokens += r.total
    else map[date].outputTokens += r.total
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      ...v,
      costUSD: calcCost(v.inputTokens, v.outputTokens),
    }))
}

export async function getCostSummary(days = 30): Promise<CostSummary> {
  const cacheKey = `cost_summary_${days}`
  const cached = await getCached<CostSummary>(cacheKey)
  if (cached) return cached

  const [dailyCosts, messages, users] = await Promise.all([
    getCostPerDay(days),
    getCollection('messages'),
    getCollection('users'),
  ])

  const totalInputTokens = dailyCosts.reduce((s, d) => s + d.inputTokens, 0)
  const totalOutputTokens = dailyCosts.reduce((s, d) => s + d.outputTokens, 0)
  const totalCostUSD = calcCost(totalInputTokens, totalOutputTokens)

  const since = new Date(Date.now() - days * 86400000)
  const [totalMessages, dauData] = await Promise.all([
    messages.countDocuments({ createdAt: { $gte: since }, isCreatedByUser: true }),
    messages
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
        { $group: { _id: '$_id.date', count: { $sum: 1 } } },
      ])
      .toArray(),
  ])

  const avgDailyMessages = totalMessages / days
  const avgDailyActiveUsers =
    (dauData as unknown as Array<{ count: number }>).reduce((s, r) => s + r.count, 0) /
    Math.max(dauData.length, 1)
  const avgDailyCost = totalCostUSD / days
  const projectedMonthlyUSD = avgDailyCost * 30

  const data: CostSummary = {
    totalInputTokens,
    totalOutputTokens,
    totalCostUSD,
    costPerActiveUser: avgDailyActiveUsers > 0 ? totalCostUSD / (avgDailyActiveUsers * days) : 0,
    costPerMessage: totalMessages > 0 ? totalCostUSD / totalMessages : 0,
    projectedMonthlyUSD,
    avgDailyActiveUsers: Math.round(avgDailyActiveUsers),
    avgDailyMessages: Math.round(avgDailyMessages),
  }
  await setCache(cacheKey, data)
  return data
}

export async function getCostByEndpoint(days = 30): Promise<CostByEndpoint[]> {
  const col = await getCollection('transactions')
  const since = new Date(Date.now() - days * 86400000)

  const result = await col
    .aggregate<{ _id: { endpoint: string; type: string }; total: number }>([
      { $match: { createdAt: { $gte: since }, tokenType: { $in: ['prompt', 'completion'] } } },
      {
        $group: {
          _id: { endpoint: { $ifNull: ['$model', 'unknown'] }, type: '$tokenType' },
          total: { $sum: { $abs: '$rawAmount' } },
        },
      },
    ])
    .toArray()

  const map: Record<string, { inputTokens: number; outputTokens: number }> = {}
  for (const r of result) {
    const key = r._id.endpoint
    if (!map[key]) map[key] = { inputTokens: 0, outputTokens: 0 }
    if (r._id.type === 'prompt') map[key].inputTokens += r.total
    else map[key].outputTokens += r.total
  }

  const items = Object.entries(map).map(([endpoint, v]) => ({
    endpoint,
    ...v,
    costUSD: calcCost(v.inputTokens, v.outputTokens),
  }))

  const total = items.reduce((s, i) => s + i.costUSD, 0)
  return items
    .map((i) => ({ ...i, percent: total > 0 ? Math.round((i.costUSD / total) * 100) : 0 }))
    .sort((a, b) => b.costUSD - a.costUSD)
}
