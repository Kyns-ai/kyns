import { getCollection } from '../mongodb'

export interface AuditEntry {
  _id: string
  adminId: string
  action: string
  path: string
  method: string
  targetId: string | null
  details: Record<string, unknown> | null
  createdAt: Date
}

export async function getAuditLog(opts: {
  action?: string
  adminId?: string
  limit?: number
  page?: number
}): Promise<{ entries: AuditEntry[]; total: number }> {
  const col = await getCollection('kyns_audit_log')
  const limit = Math.min(opts.limit ?? 50, 200)
  const page = opts.page ?? 1
  const skip = (page - 1) * limit

  const match: Record<string, unknown> = {}
  if (opts.action) match['action'] = opts.action
  if (opts.adminId) match['adminId'] = opts.adminId

  const [docs, total] = await Promise.all([
    col.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    col.countDocuments(match),
  ])

  const entries: AuditEntry[] = docs.map((d) => {
    const doc = d as Record<string, unknown>
    return {
      _id: String(d._id),
      adminId: String(doc.adminId ?? 'system'),
      action: String(doc.action ?? ''),
      path: String(doc.path ?? ''),
      method: String(doc.method ?? ''),
      targetId: doc.targetId ? String(doc.targetId) : null,
      details: (doc.details as Record<string, unknown>) ?? null,
      createdAt: (doc.createdAt as Date) ?? new Date(),
    }
  })

  return { entries, total }
}

export async function logAuditEntry(entry: {
  adminId: string
  action: string
  path: string
  method: string
  targetId?: string
  details?: Record<string, unknown>
}): Promise<void> {
  const col = await getCollection('kyns_audit_log')
  await col.insertOne({
    ...entry,
    targetId: entry.targetId ?? null,
    details: entry.details ?? null,
    createdAt: new Date(),
  })
}
