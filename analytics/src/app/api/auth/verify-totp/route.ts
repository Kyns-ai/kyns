import { NextRequest, NextResponse } from 'next/server'
import { verifyChallengeToken, signToken, cookieName, cookieMaxAge, extractIp } from '@/lib/auth'
import { getTotpConfig, validateTotpCode, consumeBackupCode, isTotpCode, isBackupCode } from '@/lib/totp'
import { logAuditEntry } from '@/lib/queries/audit'

export async function POST(req: NextRequest) {
  const ip = extractIp(req)
  const { code, challengeToken } = await req.json().catch(() => ({ code: '', challengeToken: '' }))

  if (!code || !challengeToken) {
    return NextResponse.json({ error: 'Missing code or challenge token' }, { status: 400 })
  }

  const challengeValid = await verifyChallengeToken(challengeToken, ip)
  if (!challengeValid) {
    return NextResponse.json({ error: 'Challenge expired or invalid. Please login again.' }, { status: 401 })
  }

  const totpConfig = await getTotpConfig()
  if (!totpConfig) {
    return NextResponse.json({ error: 'TOTP not configured' }, { status: 400 })
  }

  const trimmedCode = code.trim().toUpperCase()
  let verified = false
  let usedBackup = false

  if (isTotpCode(trimmedCode)) {
    verified = validateTotpCode(totpConfig.secret, trimmedCode)
  } else if (isBackupCode(trimmedCode)) {
    verified = await consumeBackupCode(trimmedCode)
    usedBackup = verified
  }

  if (!verified) {
    logAuditEntry({
      adminId: 'admin',
      action: 'totp.verify.failed',
      path: '/api/auth/verify-totp',
      method: 'POST',
      details: { ip },
    }).catch(() => {})
    return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
  }

  const token = await signToken(ip)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(cookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: cookieMaxAge(),
    path: '/',
  })

  logAuditEntry({
    adminId: 'admin',
    action: usedBackup ? 'totp.backup_used' : 'totp.verify.success',
    path: '/api/auth/verify-totp',
    method: 'POST',
    details: { ip },
  }).catch(() => {})

  return res
}
