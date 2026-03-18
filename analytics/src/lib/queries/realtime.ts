import { getCollection } from '../mongodb'
import { startOfDay } from 'date-fns'

export interface RealtimeMetrics {
  usersOnline: number
  totalUsers: number
  messagesToday: number
  messagesLast24h: number
  messagesLast7d: number
  messagesLast30d: number
  conversationsToday: number
  errorsToday: number
  imagesGeneratedToday: number
  webSearchesToday: number
}

export async function getRealtimeMetrics(): Promise<RealtimeMetrics> {
  const [messages, users, conversations] = await Promise.all([
    getCollection('messages'),
    getCollection('users'),
    getCollection('conversations'),
  ])

  const now = new Date()
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const todayStart = startOfDay(now)

  const toolcalls = await getCollection('toolcalls')

  const [
    onlineUsers,
    totalUsers,
    messagesToday,
    messagesLast24h,
    messagesLast7d,
    messagesLast30d,
    conversationsToday,
    errorsToday,
    imagesGeneratedToday,
    webSearchesToday,
  ] = await Promise.all([
    messages.distinct('user', { createdAt: { $gte: fiveMinAgo }, isCreatedByUser: true }),
    users.countDocuments({ expiresAt: { $exists: false } }),
    messages.countDocuments({ createdAt: { $gte: todayStart }, isCreatedByUser: true }),
    messages.countDocuments({ createdAt: { $gte: oneDayAgo }, isCreatedByUser: true }),
    messages.countDocuments({ createdAt: { $gte: sevenDaysAgo }, isCreatedByUser: true }),
    messages.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, isCreatedByUser: true }),
    conversations.countDocuments({ createdAt: { $gte: todayStart } }),
    messages.countDocuments({ createdAt: { $gte: todayStart }, error: true }),
    conversations.countDocuments({
      createdAt: { $gte: todayStart },
      endpoint: 'agents',
      agent_id: 'kyns-image-agent',
    }),
    toolcalls.countDocuments({
      createdAt: { $gte: todayStart },
      toolId: { $regex: /web_search/i },
    }),
  ])

  return {
    usersOnline: onlineUsers.length,
    totalUsers,
    messagesToday,
    messagesLast24h,
    messagesLast7d,
    messagesLast30d,
    conversationsToday,
    errorsToday,
    imagesGeneratedToday,
    webSearchesToday,
  }
}
