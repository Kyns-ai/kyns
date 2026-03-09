import { getCollection, getCached, setCache } from '../mongodb'

export interface FeatureUsage {
  feature: string
  label: string
  usersLast7d: number
  usersLast30d: number
  pctLast7d: number
  pctLast30d: number
  totalUsages7d: number
}

export async function getFeatureUsage(): Promise<FeatureUsage[]> {
  const cacheKey = 'feature_usage'
  const cached = await getCached<FeatureUsage[]>(cacheKey)
  if (cached) return cached

  const messages = await getCollection('messages')
  const convos = await getCollection('conversations')
  const users = await getCollection('users')

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)

  const [totalUsers7d, totalUsers30d] = await Promise.all([
    messages.distinct('user', { createdAt: { $gte: sevenDaysAgo }, isCreatedByUser: true }).then((r) => r.length),
    messages.distinct('user', { createdAt: { $gte: thirtyDaysAgo }, isCreatedByUser: true }).then((r) => r.length),
  ])

  const featureDefs = [
    {
      feature: 'characters',
      label: 'Characters',
      query7d: { createdAt: { $gte: sevenDaysAgo }, endpoint: 'agents', agent_id: { $exists: true, $nin: [null, 'kyns-image-agent'] } },
      query30d: { createdAt: { $gte: thirtyDaysAgo }, endpoint: 'agents', agent_id: { $exists: true, $nin: [null, 'kyns-image-agent'] } },
      col: 'conversations',
    },
    {
      feature: 'deep_mode',
      label: 'KYNS Deep',
      query7d: { createdAt: { $gte: sevenDaysAgo }, endpoint: 'KYNSDeep' },
      query30d: { createdAt: { $gte: thirtyDaysAgo }, endpoint: 'KYNSDeep' },
      col: 'conversations',
    },
    {
      feature: 'image_gen',
      label: 'Image Generation',
      query7d: { createdAt: { $gte: sevenDaysAgo }, endpoint: 'agents', agent_id: 'kyns-image-agent' },
      query30d: { createdAt: { $gte: thirtyDaysAgo }, endpoint: 'agents', agent_id: 'kyns-image-agent' },
      col: 'conversations',
    },
    {
      feature: 'web_search',
      label: 'Web Search',
      query7d: { createdAt: { $gte: sevenDaysAgo }, isCreatedByUser: false, text: { $regex: 'web_search|searxng|search_results', $options: 'i' } },
      query30d: { createdAt: { $gte: thirtyDaysAgo }, isCreatedByUser: false, text: { $regex: 'web_search|searxng|search_results', $options: 'i' } },
      col: 'messages',
    },
    {
      feature: 'file_upload',
      label: 'File Upload',
      query7d: {
        createdAt: { $gte: sevenDaysAgo },
        isCreatedByUser: true,
        $or: [{ 'files.0': { $exists: true } }, { 'attachments.0': { $exists: true } }],
      },
      query30d: {
        createdAt: { $gte: thirtyDaysAgo },
        isCreatedByUser: true,
        $or: [{ 'files.0': { $exists: true } }, { 'attachments.0': { $exists: true } }],
      },
      col: 'messages',
    },
  ]

  const results = await Promise.all(
    featureDefs.map(async (def) => {
      const colRef = def.col === 'conversations' ? convos : messages
      const [users7d, users30d, count7d] = await Promise.all([
        colRef.distinct('user', def.query7d).then((r) => r.length),
        colRef.distinct('user', def.query30d).then((r) => r.length),
        colRef.countDocuments(def.query7d),
      ])
      return {
        feature: def.feature,
        label: def.label,
        usersLast7d: users7d,
        usersLast30d: users30d,
        pctLast7d: totalUsers7d > 0 ? Math.round((users7d / totalUsers7d) * 100) : 0,
        pctLast30d: totalUsers30d > 0 ? Math.round((users30d / totalUsers30d) * 100) : 0,
        totalUsages7d: count7d,
      }
    })
  )

  await setCache(cacheKey, results)
  return results
}

export interface FeatureRetentionCorrelation {
  feature: string
  label: string
  retainedUsersPct: number
  churnedUsersPct: number
}

export async function getFeatureRetentionCorrelation(): Promise<FeatureRetentionCorrelation[]> {
  const cacheKey = 'feature_retention_correlation'
  const cached = await getCached<FeatureRetentionCorrelation[]>(cacheKey)
  if (cached) return cached

  const messages = await getCollection('messages')
  const convos = await getCollection('conversations')

  // Users active week 1 (14-7 days ago) — split into retained (active week 2) vs churned
  const week1Start = new Date(Date.now() - 14 * 86400000)
  const week1End = new Date(Date.now() - 7 * 86400000)
  const week2Start = week1End
  const week2End = new Date()

  const week1Users = await messages.distinct('user', {
    createdAt: { $gte: week1Start, $lt: week1End },
    isCreatedByUser: true,
  })
  const week2Users = await messages.distinct('user', {
    createdAt: { $gte: week2Start, $lt: week2End },
    isCreatedByUser: true,
  })

  const week2Set = new Set(week2Users)
  const retained = week1Users.filter((u) => week2Set.has(u))
  const churned = week1Users.filter((u) => !week2Set.has(u))

  if (retained.length === 0 && churned.length === 0) {
    await setCache(cacheKey, [])
    return []
  }

  const featureDefs = [
    {
      feature: 'characters',
      label: 'Characters',
      query: (users: string[]) => ({
        user: { $in: users },
        createdAt: { $gte: week1Start, $lt: week1End },
        endpoint: 'agents',
        agent_id: { $exists: true, $nin: [null, 'kyns-image-agent'] },
      }),
      col: 'conversations',
    },
    {
      feature: 'deep_mode',
      label: 'KYNS Deep',
      query: (users: string[]) => ({
        user: { $in: users },
        createdAt: { $gte: week1Start, $lt: week1End },
        endpoint: 'KYNSDeep',
      }),
      col: 'conversations',
    },
    {
      feature: 'image_gen',
      label: 'Image Gen',
      query: (users: string[]) => ({
        user: { $in: users },
        createdAt: { $gte: week1Start, $lt: week1End },
        endpoint: 'agents',
        agent_id: 'kyns-image-agent',
      }),
      col: 'conversations',
    },
    {
      feature: 'file_upload',
      label: 'File Upload',
      query: (users: string[]) => ({
        user: { $in: users },
        createdAt: { $gte: week1Start, $lt: week1End },
        isCreatedByUser: true,
        $or: [{ 'files.0': { $exists: true } }, { 'attachments.0': { $exists: true } }],
      }),
      col: 'messages',
    },
  ]

  const results = await Promise.all(
    featureDefs.map(async (def) => {
      const colRef = def.col === 'conversations' ? convos : messages
      const [retainedUsed, churnedUsed] = await Promise.all([
        retained.length > 0
          ? colRef.distinct('user', def.query(retained)).then((r) => r.length)
          : Promise.resolve(0),
        churned.length > 0
          ? colRef.distinct('user', def.query(churned)).then((r) => r.length)
          : Promise.resolve(0),
      ])
      return {
        feature: def.feature,
        label: def.label,
        retainedUsersPct: retained.length > 0 ? Math.round((retainedUsed / retained.length) * 100) : 0,
        churnedUsersPct: churned.length > 0 ? Math.round((churnedUsed / churned.length) * 100) : 0,
      }
    })
  )

  await setCache(cacheKey, results)
  return results
}
