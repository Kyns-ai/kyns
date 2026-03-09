import { getCollection } from '../mongodb'

export interface DailyCount { date: string; count: number }
export interface HourlyCount { hour: number; count: number }
export interface EndpointBreakdown { endpoint: string; count: number; percent: number }
export interface AgentUsage { agentId: string; name: string; messages: number; uniqueUsers: number }
export interface HeatmapCell { day: number; hour: number; count: number }

export async function getMessagesPerDay(days = 30): Promise<DailyCount[]> {
  const col = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)
  const result = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since }, isCreatedByUser: true } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray()
  return result.map((r) => ({ date: r._id, count: r.count }))
}

export async function getMessagesByHourOfDay(days = 30): Promise<HourlyCount[]> {
  const col = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)
  const result = await col
    .aggregate<{ _id: number; count: number }>([
      { $match: { createdAt: { $gte: since }, isCreatedByUser: true } },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()
  return result.map((r) => ({ hour: r._id, count: r.count }))
}

export async function getMessagesByDayHour(days = 30): Promise<HeatmapCell[]> {
  const col = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)
  const result = await col
    .aggregate<{ _id: { day: number; hour: number }; count: number }>([
      { $match: { createdAt: { $gte: since }, isCreatedByUser: true } },
      {
        $group: {
          _id: { day: { $dayOfWeek: '$createdAt' }, hour: { $hour: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray()
  return result.map((r) => ({ day: r._id.day, hour: r._id.hour, count: r.count }))
}

export async function getEndpointBreakdown(days = 30): Promise<EndpointBreakdown[]> {
  const col = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)
  const raw = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since }, isCreatedByUser: true } },
      { $group: { _id: '$endpoint', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray()
  const total = raw.reduce((s, r) => s + r.count, 0)
  return raw.map((r) => ({
    endpoint: r._id ?? 'unknown',
    count: r.count,
    percent: total > 0 ? Math.round((r.count / total) * 100) : 0,
  }))
}

export async function getAgentUsage(days = 30, limit = 20): Promise<AgentUsage[]> {
  const col = await getCollection('conversations')
  const since = new Date(Date.now() - days * 86400000)

  const convos = await col
    .aggregate<{ _id: string; name: string; conversations: number; uniqueUsers: number }>([
      {
        $match: {
          createdAt: { $gte: since },
          endpoint: 'agents',
          agent_id: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$agent_id',
          name: { $first: '$chatGptLabel' },
          conversations: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          conversations: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
        },
      },
      { $sort: { conversations: -1 } },
      { $limit: limit },
    ])
    .toArray()

  // Enrich with agent names from agents collection
  const agentCol = await getCollection('agents')
  const agentIds = convos.map((c) => c._id)
  const agents = await agentCol.find({ id: { $in: agentIds } }).toArray()
  const agentMap = Object.fromEntries(agents.map((a) => [(a as unknown as { id: string; name: string }).id, (a as unknown as { id: string; name: string }).name]))

  return convos.map((c) => ({
    agentId: c._id,
    name: agentMap[c._id] ?? c.name ?? c._id,
    messages: c.conversations,
    uniqueUsers: c.uniqueUsers,
  }))
}

export async function getImagesPerDay(days = 30): Promise<DailyCount[]> {
  const col = await getCollection('conversations')
  const since = new Date(Date.now() - days * 86400000)
  const result = await col
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          createdAt: { $gte: since },
          endpoint: 'agents',
          agent_id: 'kyns-image-agent',
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray()
  return result.map((r) => ({ date: r._id, count: r.count }))
}

export async function getUploadsPerDay(days = 30): Promise<DailyCount[]> {
  const col = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)
  const result = await col
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          createdAt: { $gte: since },
          isCreatedByUser: true,
          $or: [
            { files: { $exists: true, $not: { $size: 0 } } },
            { attachments: { $exists: true, $not: { $size: 0 } } },
          ],
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray()
  return result.map((r) => ({ date: r._id, count: r.count }))
}

export interface AvgTokensPerDay { date: string; inputTokens: number; outputTokens: number }

export async function getTokensPerDay(days = 30): Promise<AvgTokensPerDay[]> {
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
    .map(([date, v]) => ({ date, ...v }))
}
