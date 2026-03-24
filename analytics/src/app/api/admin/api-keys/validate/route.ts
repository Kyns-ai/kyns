import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCollection, withRetry } from '@/lib/mongodb'

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const key = body.key

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ valid: false }, { status: 401 })
  }

  return withRetry(async () => {
    const col = await getCollection('kyns_api_keys')
    const hash = hashKey(key)
    const doc = await col.findOne({ keyHash: hash, active: true })

    if (!doc) {
      return NextResponse.json({ valid: false }, { status: 401 })
    }

    await col.updateOne(
      { keyHash: hash },
      { $set: { lastUsedAt: new Date() }, $inc: { requests: 1 } },
    )

    return NextResponse.json({ valid: true, name: doc.name })
  })
}
