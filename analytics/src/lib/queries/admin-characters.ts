import { ObjectId } from 'mongodb'
import { getCollection } from '../mongodb'

export interface AdminCharacter {
  _id: string
  id: string
  name: string
  description: string
  instructions: string
  model: string
  isActive: boolean
  proOnly: boolean
  avatar: string
  order: number
  messageCount: number
  uniqueUsers: number
  abandonRate: number
  createdAt: Date
  updatedAt: Date
}

export async function getCharactersList(): Promise<AdminCharacter[]> {
  const agents = await getCollection('agents')
  const messages = await getCollection('messages')

  const docs = await agents.find({}).sort({ order: 1, createdAt: 1 }).toArray()

  const agentIds = docs.map((d) => String((d as Record<string, unknown>).id ?? d._id))

  const [msgAgg, userAgg, shortAgg] = await Promise.all([
    messages.aggregate([
      { $match: { agent_id: { $in: agentIds } } },
      { $group: { _id: '$agent_id', count: { $sum: 1 } } },
    ]).toArray(),
    messages.aggregate([
      { $match: { agent_id: { $in: agentIds } } },
      { $group: { _id: { agent: '$agent_id', user: '$user' } } },
      { $group: { _id: '$_id.agent', users: { $sum: 1 } } },
    ]).toArray(),
    messages.aggregate([
      { $match: { agent_id: { $in: agentIds }, isCreatedByUser: true } },
      { $group: { _id: { agent: '$agent_id', conv: '$conversationId' }, count: { $sum: 1 } } },
      { $match: { count: { $lte: 3 } } },
      { $group: { _id: '$_id.agent', shortConvos: { $sum: 1 } } },
    ]).toArray(),
  ])

  const totalConvAgg = await messages.aggregate([
    { $match: { agent_id: { $in: agentIds }, isCreatedByUser: true } },
    { $group: { _id: { agent: '$agent_id', conv: '$conversationId' } } },
    { $group: { _id: '$_id.agent', total: { $sum: 1 } } },
  ]).toArray()

  const msgMap = new Map(msgAgg.map((a) => [String(a._id), a.count as number]))
  const userMap = new Map(userAgg.map((a) => [String(a._id), a.users as number]))
  const shortMap = new Map(shortAgg.map((a) => [String(a._id), a.shortConvos as number]))
  const totalConvMap = new Map(totalConvAgg.map((a) => [String(a._id), a.total as number]))

  return docs.map((d, i) => {
    const doc = d as Record<string, unknown>
    const agentId = String(doc.id ?? d._id)
    const totalConvs = totalConvMap.get(agentId) ?? 0
    const shortConvs = shortMap.get(agentId) ?? 0
    const abandonRate = totalConvs > 0 ? Math.round((shortConvs / totalConvs) * 100) : 0

    return {
      _id: String(d._id),
      id: agentId,
      name: String(doc.name ?? ''),
      description: String(doc.description ?? ''),
      instructions: String(doc.instructions ?? doc.system_prompt ?? ''),
      model: String(doc.model ?? ''),
      isActive: doc.isActive !== false,
      proOnly: doc.proOnly === true,
      avatar: String(doc.avatar ?? ''),
      order: typeof doc.order === 'number' ? doc.order : i,
      messageCount: msgMap.get(agentId) ?? 0,
      uniqueUsers: userMap.get(agentId) ?? 0,
      abandonRate,
      createdAt: doc.createdAt as Date ?? new Date(),
      updatedAt: doc.updatedAt as Date ?? new Date(),
    }
  })
}

export async function updateCharacter(id: string, updates: Record<string, unknown>) {
  const agents = await getCollection('agents')
  let result = await agents.updateOne(
    { id },
    { $set: { ...updates, updatedAt: new Date() } }
  )
  if (result.matchedCount === 0) {
    try {
      result = await agents.updateOne(
        { _id: new ObjectId(id) },
        { $set: { ...updates, updatedAt: new Date() } }
      )
    } catch {
      // id is not an ObjectId
    }
  }
  return result
}

export async function duplicateCharacter(id: string): Promise<string | null> {
  const agents = await getCollection('agents')
  const doc = await agents.findOne({ id } as Record<string, unknown>)
  if (!doc) return null

  const d = doc as Record<string, unknown>
  const newId = new ObjectId()
  const newAgentId = `agent_${newId.toString()}`

  await agents.insertOne({
    ...d,
    _id: newId,
    id: newAgentId,
    name: `${String(d.name)} (cópia)`,
    isActive: false,
    order: (typeof d.order === 'number' ? d.order : 999) + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Record<string, unknown>)

  return newAgentId
}

export async function reorderCharacters(orderedIds: string[]) {
  const agents = await getCollection('agents')
  await Promise.all(
    orderedIds.map((id, index) =>
      agents.updateOne({ id } as Record<string, unknown>, { $set: { order: index, updatedAt: new Date() } })
    )
  )
}
