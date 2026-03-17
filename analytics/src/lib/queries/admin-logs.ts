import { ObjectId } from 'mongodb'
import { getCollection, getCached, setCache } from '../mongodb'
import { startOfDay, subDays } from 'date-fns'

export interface ErrorLog {
  _id: string
  conversationId: string
  messageId: string
  userId: string
  errorType: 'error' | 'thinking_leak' | 'looping' | 'timeout' | 'prompt_injection'
  model: string
  endpoint: string
  snippet: string
  createdAt: Date
}

export interface ModerationItem {
  _id: string
  conversationId: string
  userId: string
  endpoint: string
  agentId: string | null
  createdAt: Date
  messageCount: number
  flagReason: string
  status: 'pending' | 'reviewed' | 'ignored'
}

const THINKING_PATTERNS = ['<think>', '</think>', 'Thinking Process:', '<reasoning>', '</reasoning>']
const LOOP_MIN_BLOCK = 80
const INJECTION_PATTERNS = [
  'ignore previous instructions',
  'ignore all previous',
  'disregard your instructions',
  'forget your rules',
  'you are now',
  'act as DAN',
  'jailbreak',
  'bypass your',
  'override your',
  'pretend you are',
  'system prompt',
  'reveal your prompt',
  'show me your instructions',
  'ignore the above',
  'do anything now',
]

function detectThinkingLeak(text: string): boolean {
  return THINKING_PATTERNS.some((p) => text.includes(p))
}

function detectLooping(text: string): boolean {
  if (text.length < LOOP_MIN_BLOCK * 2) return false
  const block = text.substring(0, LOOP_MIN_BLOCK)
  return text.indexOf(block, LOOP_MIN_BLOCK) !== -1
}

function detectPromptInjection(text: string): boolean {
  const lower = text.toLowerCase()
  return INJECTION_PATTERNS.some((p) => lower.includes(p))
}

export async function getErrorLogs(opts: {
  type?: string
  userId?: string
  conversationId?: string
  limit?: number
  page?: number
}): Promise<{ logs: ErrorLog[]; total: number }> {
  const messages = await getCollection('messages')
  const limit = Math.min(opts.limit ?? 50, 200)
  const page = opts.page ?? 1
  const skip = (page - 1) * limit

  const errorTypes: string[] = opts.type ? [opts.type] : ['error', 'thinking_leak', 'looping', 'timeout', 'prompt_injection']

  const includesInjection = errorTypes.includes('prompt_injection')
  const match: Record<string, unknown> = includesInjection && errorTypes.length === 1
    ? { isCreatedByUser: true }
    : includesInjection
      ? {}
      : { isCreatedByUser: false }
  if (opts.userId) match['user'] = opts.userId
  if (opts.conversationId) match['conversationId'] = opts.conversationId

  // For pure "error" type, we can filter directly in MongoDB
  if (errorTypes.length === 1 && errorTypes[0] === 'error') {
    match['error'] = true
  }

  // Fetch a reasonable window for analysis
  const fetchLimit = Math.min((page + 4) * limit * 4, 2000)
  const docs = await messages.find(match).sort({ createdAt: -1 }).limit(fetchLimit).toArray()

  const logs: ErrorLog[] = []
  for (const d of docs) {
    const doc = d as Record<string, unknown>
    const text = String(doc.text ?? '')
    const isError = doc.error === true
    const isThink = detectThinkingLeak(text)
    const isLoop = detectLooping(text)
    const isTimeout = text.includes('timeout') || text.includes('timed out')
    const isInjection = doc.isCreatedByUser === true && detectPromptInjection(text)

    const types: ErrorLog['errorType'][] = []
    if (isError && errorTypes.includes('error')) types.push('error')
    if (isThink && errorTypes.includes('thinking_leak')) types.push('thinking_leak')
    if (isLoop && errorTypes.includes('looping')) types.push('looping')
    if (isTimeout && errorTypes.includes('timeout')) types.push('timeout')
    if (isInjection && errorTypes.includes('prompt_injection')) types.push('prompt_injection' as ErrorLog['errorType'])

    for (const t of types) {
      logs.push({
        _id: String(d._id),
        conversationId: String(doc.conversationId ?? ''),
        messageId: String(doc.messageId ?? d._id),
        userId: String(doc.user ?? ''),
        errorType: t,
        model: String(doc.model ?? ''),
        endpoint: String(doc.endpoint ?? ''),
        snippet: text.substring(0, 200),
        createdAt: (doc.createdAt as Date) ?? new Date(),
      })
    }
  }

  const total = logs.length
  const paginated = logs.slice(skip, skip + limit)

  return { logs: paginated, total }
}

export async function getModerationFeed(opts: {
  status?: string
  limit?: number
  page?: number
  keywords?: string[]
}): Promise<{ items: ModerationItem[]; total: number }> {
  const messages = await getCollection('messages')
  const flagCol = await getCollection('kyns_moderation_flags')

  const limit = opts.limit ?? 50
  const page = opts.page ?? 1
  const skip = (page - 1) * limit

  const statusMatch: Record<string, unknown> = {}
  if (opts.status && opts.status !== 'all') statusMatch['status'] = opts.status

  const [flagged, total] = await Promise.all([
    flagCol.find(statusMatch).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    flagCol.countDocuments(statusMatch),
  ])

  const items: ModerationItem[] = flagged.map((f) => {
    const doc = f as Record<string, unknown>
    return {
      _id: String(f._id),
      conversationId: String(doc.conversationId ?? ''),
      userId: String(doc.userId ?? ''),
      endpoint: String(doc.endpoint ?? ''),
      agentId: doc.agentId ? String(doc.agentId) : null,
      createdAt: (doc.createdAt as Date) ?? new Date(),
      messageCount: Number(doc.messageCount ?? 0),
      flagReason: String(doc.flagReason ?? ''),
      status: (doc.status as ModerationItem['status']) ?? 'pending',
    }
  })

  if (opts.keywords?.length) {
    const keywordRegex = new RegExp(opts.keywords.join('|'), 'i')
    const recentMsgs = await messages.find({
      createdAt: { $gte: new Date(Date.now() - 24 * 3600_000) },
      isCreatedByUser: true,
      text: { $regex: keywordRegex },
    }).limit(100).toArray()

    const existing = new Set(items.map((i) => i.conversationId))
    for (const msg of recentMsgs) {
      const doc = msg as Record<string, unknown>
      const cid = String(doc.conversationId ?? '')
      if (!existing.has(cid)) {
        await flagCol.updateOne(
          { conversationId: cid },
          {
            $setOnInsert: {
              conversationId: cid,
              userId: String(doc.user ?? ''),
              endpoint: String(doc.endpoint ?? ''),
              agentId: doc.agent_id ? String(doc.agent_id) : null,
              createdAt: new Date(),
              messageCount: 0,
              flagReason: 'keyword_match',
              status: 'pending',
            },
          },
          { upsert: true }
        )
      }
    }
  }

  return { items, total }
}

export async function updateModerationItem(id: string, status: string) {
  const flagCol = await getCollection('kyns_moderation_flags')
  let oid: ObjectId | string
  try {
    oid = new ObjectId(id)
  } catch {
    oid = id
  }
  await flagCol.updateOne(
    { _id: oid as ObjectId },
    { $set: { status, reviewedAt: new Date() } }
  )
}

export async function flagConversation(conversationId: string, reason: string, userId: string) {
  const flagCol = await getCollection('kyns_moderation_flags')
  await flagCol.updateOne(
    { conversationId },
    {
      $set: { flagReason: reason, status: 'pending', updatedAt: new Date() },
      $setOnInsert: { conversationId, userId, createdAt: new Date(), messageCount: 0 },
    },
    { upsert: true }
  )
}

const BLOCKED_RESPONSE_TEXT = 'Essa conversa não pode continuar nessa direção.'

export interface CsamBlockStats {
  blocksToday: number
  blocks7d: number
  blockRatePct: number
  dailyCounts: Array<{ date: string; count: number }>
}

export async function getCsamBlockStats(days = 7): Promise<CsamBlockStats> {
  const cacheKey = `csam_blocks_${days}`
  const cached = await getCached<CsamBlockStats>(cacheKey)
  if (cached) return cached

  const messages = await getCollection('messages')
  const now = new Date()
  const todayStart = startOfDay(now)
  const since = subDays(todayStart, days)

  const [blockedMessages, totalMessagesToday, totalMessages7d] = await Promise.all([
    messages
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            createdAt: { $gte: since },
            isCreatedByUser: false,
            text: BLOCKED_RESPONSE_TEXT,
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
      .toArray(),
    messages.countDocuments({ createdAt: { $gte: todayStart }, isCreatedByUser: true }),
    messages.countDocuments({ createdAt: { $gte: since }, isCreatedByUser: true }),
  ])

  const dailyCounts = blockedMessages.map((d) => ({ date: d._id, count: d.count }))
  const todayStr = todayStart.toISOString().substring(0, 10)
  const blocksToday = dailyCounts.find((d) => d.date === todayStr)?.count ?? 0
  const blocks7d = dailyCounts.reduce((s, d) => s + d.count, 0)
  const blockRatePct = totalMessages7d > 0 ? Math.round((blocks7d / totalMessages7d) * 10000) / 100 : 0

  const data: CsamBlockStats = { blocksToday, blocks7d, blockRatePct, dailyCounts }
  await setCache(cacheKey, data)
  return data
}
