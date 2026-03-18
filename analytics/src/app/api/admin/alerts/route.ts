import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAllConfig, updateConfig } from '@/lib/queries/admin-config'
import { logAuditEntry } from '@/lib/queries/audit'

export async function GET(req: NextRequest)  {
  try {
    if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const config = await getAllConfig()
    return NextResponse.json({
      webhook: config.alertWebhook,
      email: config.alertEmail,
      thresholds: config.alertThresholds,
    })

  } catch (e) {
    console.error('[API]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest)  {
  try {
    if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json() as Record<string, unknown>
    await updateConfig({
      alertWebhook: String(body.webhook ?? ''),
      alertEmail: String(body.email ?? ''),
      alertThresholds: body.thresholds as Parameters<typeof updateConfig>[0]['alertThresholds'],
    })
    logAuditEntry({
      adminId: 'admin',
      action: 'alert.update',
      path: '/api/admin/alerts',
      method: 'PUT',
      details: body,
    }).catch(() => {})
    return NextResponse.json({ ok: true })

  } catch (e) {
    console.error('[API]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
