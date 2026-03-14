import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getTotpPending, validateTotpCode, confirmTotp } from '@/lib/totp'
import { logAuditEntry } from '@/lib/queries/audit'

export async function POST(req: NextRequest) {
  if (!await isAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await req.json().catch(() => ({ code: '' }))
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'Enter a 6-digit code from your authenticator' }, { status: 400 })
  }

  const pending = await getTotpPending()
  if (!pending) {
    return NextResponse.json({ error: 'No pending TOTP setup. Start again.' }, { status: 400 })
  }

  const valid = validateTotpCode(pending.secret, code)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid code. Make sure your authenticator is synced.' }, { status: 401 })
  }

  await confirmTotp(pending.secret, pending.backupCodes)

  logAuditEntry({
    adminId: 'admin',
    action: 'totp.setup.confirmed',
    path: '/api/auth/totp/confirm',
    method: 'POST',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
