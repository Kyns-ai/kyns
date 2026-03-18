import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAllConfig, updateConfig } from '@/lib/queries/admin-config'
import { logAuditEntry } from '@/lib/queries/audit'
import type { PlatformConfig } from '@/lib/queries/admin-config'

export async function GET(req: NextRequest)  {
  try {
    if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const config = await getAllConfig()
    return NextResponse.json(config)

  } catch (e) {
    console.error('[API]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest)  {
  try {
    if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json() as Partial<PlatformConfig>
    await updateConfig(body)
    logAuditEntry({
      adminId: 'admin',
      action: 'config.update',
      path: '/api/admin/config',
      method: 'PUT',
      details: body as Record<string, unknown>,
    }).catch(() => {})
    return NextResponse.json({ ok: true })

  } catch (e) {
    console.error('[API]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
