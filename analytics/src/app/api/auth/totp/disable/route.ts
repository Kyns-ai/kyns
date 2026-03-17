import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getTotpConfig, validateTotpCode, consumeBackupCode, deleteTotpConfig, isTotpCode, isBackupCode } from '@/lib/totp'
import { logAuditEntry } from '@/lib/queries/audit'

export async function POST(req: NextRequest) {
  if (!await isAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await req.json().catch(() => ({ code: '' }))
  if (!code) {
    return NextResponse.json({ error: 'A TOTP code or backup code is required to disable 2FA' }, { status: 400 })
  }

  const config = await getTotpConfig()
  if (!config) {
    return NextResponse.json({ error: '2FA is not configured' }, { status: 400 })
  }

  const trimmed = code.trim().toUpperCase()
  let verified = false

  if (isTotpCode(trimmed)) {
    verified = validateTotpCode(config.secret, trimmed)
  } else if (isBackupCode(trimmed)) {
    verified = await consumeBackupCode(trimmed)
  }

  if (!verified) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  await deleteTotpConfig()

  logAuditEntry({
    adminId: 'admin',
    action: 'totp.disabled',
    path: '/api/auth/totp/disable',
    method: 'POST',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
