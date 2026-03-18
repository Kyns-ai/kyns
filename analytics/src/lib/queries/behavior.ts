import { getCollection, getCached, setCache } from '../mongodb'

export interface WordFrequency { word: string; count: number }
export interface LengthBucket { bucket: string; count: number }
export interface ConversationStats {
  deepEngagementRate: number
  avgTurnsPerConvo: number
  abandonmentRate: number
  avgTimeBetweenMessages: number
}

const STOPWORDS = new Set([
  'a', 'o', 'e', 'de', 'do', 'da', 'em', 'um', 'uma', 'para', 'que', 'com', 'se',
  'por', 'na', 'no', 'não', 'eu', 'me', 'te', 'the', 'a', 'an', 'is', 'are', 'was',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'how', 'what', 'when',
  'where', 'why', 'can', 'could', 'would', 'should', 'will', 'do', 'did', 'have', 'has',
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'as', 'this', 'that', 'or', 'and', 'but',
  'mais', 'mas', 'como', 'sua', 'seu', 'seus', 'suas', 'este', 'esta', 'isso', 'esse', 'essa',
])

export async function getTopFirstMessageWords(limit = 50): Promise<WordFrequency[]> {
  const cacheKey = 'top_first_words'
  const cached = await getCached<WordFrequency[]>(cacheKey)
  if (cached) return cached

  const col = await getCollection('conversations')
  const messages = await getCollection('messages')
  const since = new Date(Date.now() - 30 * 86400000)

  // Message content analysis removed for privacy compliance
  const result: { word: string; count: number }[] = []

  await setCache(cacheKey, result)
  return result
}

export async function getMessageLengthDistribution(): Promise<LengthBucket[]> {
  const cacheKey = 'msg_length_dist'
  const cached = await getCached<LengthBucket[]>(cacheKey)
  if (cached) return cached

  const col = await getCollection('messages')
  const since = new Date(Date.now() - 30 * 86400000)

  const result = await col
    .aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: since }, isCreatedByUser: true, text: { $exists: true } } },
      {
        $addFields: {
          charLen: { $strLenCP: { $ifNull: ['$text', ''] } },
        },
      },
      {
        $bucket: {
          groupBy: '$charLen',
          boundaries: [0, 50, 150, 300, 500, 1000, 2000, 5000, 99999],
          default: '5000+',
          output: { count: { $sum: 1 } },
        },
      },
    ])
    .toArray()

  const labels: Record<string, string> = {
    '0': '0-50',
    '50': '50-150',
    '150': '150-300',
    '300': '300-500',
    '500': '500-1k',
    '1000': '1k-2k',
    '2000': '2k-5k',
    '5000+': '5k+',
  }

  const mapped = result.map((r) => ({
    bucket: labels[String(r._id)] ?? String(r._id),
    count: r.count,
  }))

  await setCache(cacheKey, mapped)
  return mapped
}

export async function getConversationStats(days = 30): Promise<ConversationStats> {
  const cacheKey = `convo_stats_${days}`
  const cached = await getCached<ConversationStats>(cacheKey)
  if (cached) return cached

  const messages = await getCollection('messages')
  const since = new Date(Date.now() - days * 86400000)

  const turnsPerConvo = await messages
    .aggregate<{ _id: string; turns: number }>([
      { $match: { createdAt: { $gte: since }, isCreatedByUser: true } },
      { $group: { _id: '$conversationId', turns: { $sum: 1 } } },
    ])
    .toArray()

  if (turnsPerConvo.length === 0) {
    return { deepEngagementRate: 0, avgTurnsPerConvo: 0, abandonmentRate: 0, avgTimeBetweenMessages: 0 }
  }

  const deepEngagement = turnsPerConvo.filter((c) => c.turns >= 10).length
  const abandoned = turnsPerConvo.filter((c) => c.turns === 1).length
  const avgTurns =
    turnsPerConvo.reduce((s, c) => s + c.turns, 0) / turnsPerConvo.length

  const data: ConversationStats = {
    deepEngagementRate: Math.round((deepEngagement / turnsPerConvo.length) * 100),
    avgTurnsPerConvo: Math.round(avgTurns * 10) / 10,
    abandonmentRate: Math.round((abandoned / turnsPerConvo.length) * 100),
    avgTimeBetweenMessages: 0,
  }

  await setCache(cacheKey, data)
  return data
}

export async function getNewUserActivityByHour(days = 30): Promise<Array<{ hour: number; count: number }>> {
  const users = await getCollection('users')
  const since = new Date(Date.now() - days * 86400000)

  const result = await users
    .aggregate<{ _id: number; count: number }>([
      { $match: { createdAt: { $gte: since }, expiresAt: { $exists: false } } },
      { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray()

  return result.map((r) => ({ hour: r._id, count: r.count }))
}
