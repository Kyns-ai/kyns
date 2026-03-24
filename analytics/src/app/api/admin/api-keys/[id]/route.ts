import { NextRequest, NextResponse } from 'next/server'
import { getCollection, withRetry } from '@/lib/mongodb'
import { isAuthenticated } from '@/lib/auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await isAuthenticated(req)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = params

  return withRetry(async () => {
    const col = await getCollection('kyns_api_keys')
    const result = await col.updateOne(
      { keyId: id },
      { $set: { active: false, revokedAt: new Date() } },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Key revogada', id })
  })
}
