import { getCollection, getCached, setCache } from '../mongodb'

export interface CharacterStats {
  agentId: string
  name: string
  totalMessages: number
  uniqueUsers: number
  avgMessagesPerConvo: number
  abandonmentRate: number
  avgConversationTurns: number
}

export interface CharacterHeatmap {
  agentId: string
  name: string
  data: Array<{ day: number; hour: number; count: number }>
}

export async function getCharacterStats(days = 30): Promise<CharacterStats[]> {
  const cacheKey = `characters_stats_${days}`
  const cached = await getCached<CharacterStats[]>(cacheKey)
  if (cached) return cached

  const convos = await getCollection('conversations')
  const messages = await getCollection('messages')
  const agentsCol = await getCollection('agents')

  const since = new Date(Date.now() - days * 86400000)

  // Get all agent conversations with message counts
  const convoStats = await convos
    .aggregate<{
      _id: string
      name: string
      totalConvos: number
      uniqueUsers: string[]
    }>([
      {
        $match: {
          createdAt: { $gte: since },
          endpoint: 'agents',
          agent_id: { $exists: true, $nin: [null, 'kyns-image-agent'] },
        },
      },
      {
        $group: {
          _id: '$agent_id',
          name: { $first: '$chatGptLabel' },
          totalConvos: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' },
          conversationIds: { $push: '$conversationId' },
        },
      },
    ])
    .toArray()

  // Get agent names from agents collection
  const agentIds = convoStats.map((c) => c._id)
  const agents = await agentsCol.find({ id: { $in: agentIds } }).toArray()
  const agentNameMap = Object.fromEntries(agents.map((a) => [(a as unknown as { id: string; name: string }).id, (a as unknown as { id: string; name: string }).name]))

  // Get message stats per agent
  const msgStats = await messages
    .aggregate<{
      _id: string
      totalMessages: number
      convoMessageCounts: Array<{ convoId: string; count: number }>
    }>([
      {
        $match: {
          createdAt: { $gte: since },
          isCreatedByUser: true,
          endpoint: 'agents',
        },
      },
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: 'conversationId',
          as: 'convo',
        },
      },
      { $unwind: { path: '$convo', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$convo.agent_id',
          totalMessages: { $sum: 1 },
        },
      },
    ])
    .toArray()

  const msgMap: Record<string, number> = {}
  for (const m of msgStats) {
    if (m._id) msgMap[m._id] = m.totalMessages
  }

  // Get abandonment (convos with < 3 user messages)
  const shortConvos = await messages
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          createdAt: { $gte: since },
          isCreatedByUser: true,
          endpoint: 'agents',
        },
      },
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: 'conversationId',
          as: 'convo',
        },
      },
      { $unwind: { path: '$convo', preserveNullAndEmptyArrays: true } },
      { $group: { _id: { convoId: '$conversationId', agentId: '$convo.agent_id' }, count: { $sum: 1 } } },
      { $match: { count: { $lt: 3 } } },
      { $group: { _id: '$_id.agentId', shortConvos: { $sum: 1 } } },
    ])
    .toArray()

  const shortMap: Record<string, number> = {}
  for (const s of shortConvos) {
    if (s._id) shortMap[s._id] = (s as unknown as { shortConvos: number }).shortConvos
  }

  const result: CharacterStats[] = convoStats
    .filter((c) => c._id !== 'kyns-image-agent')
    .map((c) => {
      const totalMessages = msgMap[c._id] ?? 0
      const totalConvos = c.totalConvos
      const abandonRate =
        totalConvos > 0 ? Math.round(((shortMap[c._id] ?? 0) / totalConvos) * 100) : 0
      return {
        agentId: c._id,
        name: agentNameMap[c._id] ?? c.name ?? c._id,
        totalMessages,
        uniqueUsers: c.uniqueUsers.length,
        avgMessagesPerConvo: totalConvos > 0 ? Math.round((totalMessages / totalConvos) * 10) / 10 : 0,
        abandonmentRate: abandonRate,
        avgConversationTurns: totalConvos > 0 ? Math.round((totalMessages / totalConvos) * 10) / 10 : 0,
      }
    })
    .sort((a, b) => b.totalMessages - a.totalMessages)

  await setCache(cacheKey, result)
  return result
}

export async function getCharacterRetention(days = 30): Promise<
  Array<{ agentId: string; name: string; d7RetentionProxy: number }>
> {
  const cacheKey = `char_retention_${days}`
  const cached = await getCached<Array<{ agentId: string; name: string; d7RetentionProxy: number }>>(cacheKey)
  if (cached) return cached

  const convos = await getCollection('conversations')
  const messages = await getCollection('messages')
  const agentsCol = await getCollection('agents')

  const since = new Date(Date.now() - 14 * 86400000) // last 14 days
  const cutoff = new Date(Date.now() - 7 * 86400000) // used in first week, returned in second

  const agentConvos = await convos
    .aggregate<{ _id: string; users: string[]; name: string }>([
      {
        $match: {
          createdAt: { $gte: since, $lt: cutoff },
          endpoint: 'agents',
          agent_id: { $exists: true, $nin: [null, 'kyns-image-agent'] },
        },
      },
      {
        $group: {
          _id: '$agent_id',
          users: { $addToSet: '$user' },
          name: { $first: '$chatGptLabel' },
        },
      },
    ])
    .toArray()

  const agents = await agentsCol.find({ id: { $in: agentConvos.map((c) => c._id) } }).toArray()
  const nameMap = Object.fromEntries(agents.map((a) => [(a as unknown as { id: string; name: string }).id, (a as unknown as { id: string; name: string }).name]))

  const result = await Promise.all(
    agentConvos.map(async (c) => {
      const returned = await messages
        .distinct('user', {
          user: { $in: c.users },
          createdAt: { $gte: cutoff },
        })
        .then((r) => r.length)
      return {
        agentId: c._id,
        name: nameMap[c._id] ?? c.name ?? c._id,
        d7RetentionProxy: c.users.length > 0 ? Math.round((returned / c.users.length) * 100) : 0,
      }
    })
  )

  await setCache(cacheKey, result)
  return result.sort((a, b) => b.d7RetentionProxy - a.d7RetentionProxy)
}
