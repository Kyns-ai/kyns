import { ObjectId } from 'mongodb'
import { getCollection } from '../mongodb'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export interface AdminUser {
  _id: string
  name: string
  email: string
  provider: string
  createdAt: Date
  updatedAt: Date
  lastActive: Date | null
  totalMessages: number
  totalConversations: number
  favoriteMode: string
  status: 'active' | 'inactive' | 'banned'
  role: string
  balance: number
  plan: string
}

export interface UserListResult {
  users: AdminUser[]
  total: number
  page: number
  pages: number
}

function toObjectId(id: string): ObjectId | string {
  try { return new ObjectId(id) } catch { return id }
}

export async function getUserList(opts: {
  search?: string
  status?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}): Promise<UserListResult> {
  const users = await getCollection('users')
  const messages = await getCollection('messages')
  const conversations = await getCollection('conversations')

  const page = opts.page ?? 1
  const limit = Math.min(opts.limit ?? 50, 200)
  const skip = (page - 1) * limit

  const match: Record<string, unknown> = {}
  if (opts.search) {
    const re = new RegExp(escapeRegExp(opts.search), 'i')
    match['$or'] = [{ name: re }, { email: re }]
  }
  if (opts.status === 'banned') match['banned'] = true
  else if (opts.status === 'inactive') {
    const cutoff = new Date(Date.now() - 30 * 86400_000)
    match['banned'] = { $ne: true }
    match['updatedAt'] = { $lt: cutoff }
  } else if (opts.status === 'active') {
    const cutoff = new Date(Date.now() - 30 * 86400_000)
    match['banned'] = { $ne: true }
    match['updatedAt'] = { $gte: cutoff }
  }

  const sortField = opts.sort ?? 'createdAt'
  const sortDir = opts.order === 'asc' ? 1 : -1

  const [docs, total] = await Promise.all([
    users.find(match).sort({ [sortField]: sortDir }).skip(skip).limit(limit).toArray(),
    users.countDocuments(match),
  ])

  const userIds = docs.map((d) => String(d._id))

  const [msgAgg, convoAgg] = await Promise.all([
    messages.aggregate([
      { $match: { user: { $in: userIds }, isCreatedByUser: true } },
      { $group: { _id: '$user', count: { $sum: 1 }, lastMsg: { $max: '$createdAt' }, modes: { $push: '$endpoint' } } },
    ]).toArray(),
    conversations.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]).toArray(),
  ])

  const msgMap = new Map(msgAgg.map((a) => [String(a._id), a]))
  const convoMap = new Map(convoAgg.map((a) => [String(a._id), a.count as number]))

  return {
    users: docs.map((d) => {
      const uid = String(d._id)
      const stats = msgMap.get(uid)
      const modes = (stats?.modes ?? []) as string[]
      const modeCount: Record<string, number> = {}
      for (const m of modes) modeCount[m] = (modeCount[m] ?? 0) + 1
      const favoriteMode = Object.entries(modeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
      const banned = (d as Record<string, unknown>).banned === true
      const lastActive = (stats?.lastMsg as Date | undefined) ?? null
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000)
      const status: AdminUser['status'] = banned
        ? 'banned'
        : lastActive && lastActive > thirtyDaysAgo
          ? 'active'
          : 'inactive'

      return {
        _id: uid,
        name: String((d as Record<string, unknown>).name ?? ''),
        email: String((d as Record<string, unknown>).email ?? ''),
        provider: String((d as Record<string, unknown>).provider ?? 'local'),
        createdAt: (d as Record<string, unknown>).createdAt as Date,
        updatedAt: (d as Record<string, unknown>).updatedAt as Date,
        lastActive,
        totalMessages: stats?.count ?? 0,
        totalConversations: convoMap.get(uid) ?? 0,
        favoriteMode,
        status,
        role: String((d as Record<string, unknown>).role ?? 'user'),
        balance: Number((d as Record<string, unknown>).tokenBalance ?? 0),
        plan: String((d as Record<string, unknown>).plan ?? 'free'),
      }
    }),
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function getUserById(id: string): Promise<AdminUser | null> {
  const users = await getCollection('users')
  const d = await users.findOne({ _id: toObjectId(id) as ObjectId })
  if (!d) return null

  const messages = await getCollection('messages')
  const conversations = await getCollection('conversations')
  const userId = String(d._id)

  const [msgCount, convoCount, lastMsg] = await Promise.all([
    messages.countDocuments({ user: userId, isCreatedByUser: true }),
    conversations.countDocuments({ user: userId }),
    messages.find({ user: userId }).sort({ createdAt: -1 }).limit(1).toArray(),
  ])

  const lastActive = lastMsg[0] ? (lastMsg[0] as Record<string, unknown>).createdAt as Date : null
  const banned = (d as Record<string, unknown>).banned === true
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000)
  const status: AdminUser['status'] = banned ? 'banned' : lastActive && lastActive > thirtyDaysAgo ? 'active' : 'inactive'

  return {
    _id: userId,
    name: String((d as Record<string, unknown>).name ?? ''),
    email: String((d as Record<string, unknown>).email ?? ''),
    provider: String((d as Record<string, unknown>).provider ?? 'local'),
    createdAt: (d as Record<string, unknown>).createdAt as Date,
    updatedAt: (d as Record<string, unknown>).updatedAt as Date,
    lastActive,
    totalMessages: msgCount,
    totalConversations: convoCount,
    favoriteMode: '—',
    status,
    role: String((d as Record<string, unknown>).role ?? 'user'),
    balance: Number((d as Record<string, unknown>).tokenBalance ?? 0),
    plan: String((d as Record<string, unknown>).plan ?? 'free'),
  }
}

export async function getUserRecentConversations(userId: string) {
  const conversations = await getCollection('conversations')
  const messages = await getCollection('messages')

  // LibreChat stores conversations with _id as the ObjectId and conversationId as a separate string field
  const convs = await conversations.find({ user: userId }).sort({ updatedAt: -1 }).limit(20).toArray()

  return Promise.all(convs.map(async (c) => {
    const doc = c as Record<string, unknown>
    // conversationId is a dedicated string field in LibreChat conversations
    const convId = String(doc.conversationId ?? doc._id ?? '')
    const msgCount = convId ? await messages.countDocuments({ conversationId: convId }) : 0
    return {
      conversationId: convId,
      endpoint: doc.endpoint ?? '—',
      model: doc.model ?? '',
      agentId: doc.agent_id ?? null,
      title: doc.title ?? 'Sem título',
      createdAt: doc.createdAt,
      messageCount: msgCount,
    }
  }))
}

export async function updateUser(id: string, updates: Record<string, unknown>) {
  const users = await getCollection('users')
  return users.updateOne(
    { _id: toObjectId(id) as ObjectId },
    { $set: { ...updates, updatedAt: new Date() } }
  )
}

export async function deleteUser(id: string) {
  const users = await getCollection('users')
  return users.deleteOne({ _id: toObjectId(id) as ObjectId })
}

export async function getSuspiciousUsers() {
  const messages = await getCollection('messages')
  const oneHourAgo = new Date(Date.now() - 3600_000)

  const agg = await messages.aggregate([
    { $match: { createdAt: { $gte: oneHourAgo }, isCreatedByUser: true } },
    { $group: { _id: '$user', count: { $sum: 1 } } },
    { $match: { count: { $gte: 50 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]).toArray()

  if (!agg.length) return []

  const users = await getCollection('users')
  // user field in messages is a string representation of ObjectId
  // need to convert to ObjectId for lookup
  const objectIds = agg.map((a) => {
    try { return new ObjectId(String(a._id)) } catch { return null }
  }).filter(Boolean) as ObjectId[]

  const userDocs = await users.find({ _id: { $in: objectIds } }).toArray()
  const userMap = new Map(userDocs.map((u) => [String(u._id), u]))

  return agg.map((a) => {
    const uid = String(a._id)
    const userDoc = userMap.get(uid) as Record<string, unknown> | undefined
    return {
      userId: uid,
      msgsLastHour: a.count as number,
      email: String(userDoc?.email ?? '—'),
      name: String(userDoc?.name ?? '—'),
    }
  })
}
