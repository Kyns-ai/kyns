import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { updateModerationItem } from '@/lib/queries/admin-logs'
import { updateUser } from '@/lib/queries/admin-users'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { action, userId, status } = await req.json() as { action?: string; userId?: string; status?: string }
    if (action === 'ban_user' && userId) {
      await updateUser(userId, { banned: true })
    }
    if (status) {
      await updateModerationItem(params.id, status)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[API /admin/moderation/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
