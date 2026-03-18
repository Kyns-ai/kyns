import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { updateCharacter, duplicateCharacter } from '@/lib/queries/admin-characters'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await req.json() as Record<string, unknown>
    if (body.action === 'duplicate') {
      const newId = await duplicateCharacter(params.id)
      return NextResponse.json({ ok: true, newId })
    }
    const allowed = ['isActive', 'name', 'description', 'instructions', 'model', 'proOnly', 'avatar', 'order']
    const updates: Record<string, unknown> = {}
    for (const f of allowed) if (f in body) updates[f] = body[f]
    await updateCharacter(params.id, updates)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[API /admin/characters/[id]]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
