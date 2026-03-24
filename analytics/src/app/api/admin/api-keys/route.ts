import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCollection, withRetry } from '@/lib/mongodb'
import { isAuthenticated } from '@/lib/auth'

interface ApiKeyDoc {
  keyId: string
  keyHash: string
  keyPrefix: string
  name: string
  active: boolean
  createdAt: Date
  revokedAt?: Date
  lastUsedAt?: Date
  requests: number
}

function generateKey(): string {
  return `sk-kyns-${crypto.randomBytes(24).toString('hex')}`
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export async function GET(req: NextRequest) {
  const auth = await isAuthenticated(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return withRetry(async () => {
    const col = await getCollection<ApiKeyDoc>('kyns_api_keys')
    const keys = await col.find({}).sort({ createdAt: -1 }).toArray()

    return NextResponse.json({
      keys: keys.map((k) => ({
        id: k.keyId,
        name: k.name,
        prefix: k.keyPrefix,
        active: k.active,
        createdAt: k.createdAt,
        revokedAt: k.revokedAt,
        lastUsedAt: k.lastUsedAt,
        requests: k.requests,
      })),
    })
  })
}

export async function POST(req: NextRequest) {
  const auth = await isAuthenticated(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const plainKey = generateKey()
  const doc: ApiKeyDoc = {
    keyId: crypto.randomBytes(4).toString('hex'),
    keyHash: hashKey(plainKey),
    keyPrefix: plainKey.slice(0, 12) + '...',
    name,
    active: true,
    createdAt: new Date(),
    requests: 0,
  }

  return withRetry(async () => {
    const col = await getCollection<ApiKeyDoc>('kyns_api_keys')
    await col.insertOne(doc)

    return NextResponse.json({
      id: doc.keyId,
      key: plainKey,
      name: doc.name,
      prefix: doc.keyPrefix,
    }, { status: 201 })
  })
}
