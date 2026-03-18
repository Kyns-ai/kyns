import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getUserById, getUserRecentConversations, updateUser, deleteUser } from '@/lib/queries/admin-users'
import { logAuditEntry } from '@/lib/queries/audit'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = req.nextUrl
    if (searchParams.get('conversations') === 'true') {
      const convs = await getUserRecentConversations(params.id)
      return NextResponse.json(convs)
    }
    const user = await getUserById(params.id)
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(user)
  } catch (e) {
    console.error('[API /admin/users/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json() as Record<string, unknown>
    const { action, ...data } = body
    const allowedFields = ['banned', 'role', 'plan', 'tokenBalance', 'name']
    if (action === 'ban') await updateUser(params.id, { banned: true })
    else if (action === 'unban') await updateUser(params.id, { banned: false })
    else if (action === 'update') {
      const updates: Record<string, unknown> = {}
      for (const f of allowedFields) if (f in data) updates[f] = data[f]
      await updateUser(params.id, updates)
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    logAuditEntry({
      adminId: 'admin',
      action: action === 'ban' ? 'user.ban' : action === 'unban' ? 'user.unban' : 'user.update',
      path: `/api/admin/users/${params.id}`,
      method: 'PATCH',
      targetId: params.id,
      details: body,
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[API /admin/users/[id] PATCH]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    await deleteUser(params.id)
    logAuditEntry({
      adminId: 'admin',
      action: 'user.delete',
      path: `/api/admin/users/${params.id}`,
      method: 'DELETE',
      targetId: params.id,
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[API /admin/users/[id] DELETE]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
