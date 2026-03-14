import { NextRequest, NextResponse } from 'next/server'
import { signToken, signChallengeToken, checkPassword, cookieName, cookieMaxAge, extractIp } from '@/lib/auth'
import { getTotpConfig } from '@/lib/totp'
import { logAuditEntry } from '@/lib/queries/audit'

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000

const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

export async function POST(req: NextRequest) {
  const ip = extractIp(req)

  if (isRateLimited(ip)) {
    logAuditEntry({
      adminId: 'system',
      action: 'login.rate_limited',
      path: '/api/auth/login',
      method: 'POST',
      details: { ip },
    }).catch(() => {})
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
      { status: 429 }
    )
  }

  const { password } = await req.json().catch(() => ({ password: '' }))

  if (!checkPassword(password)) {
    logAuditEntry({
      adminId: 'system',
      action: 'login.failed',
      path: '/api/auth/login',
      method: 'POST',
      details: { ip },
    }).catch(() => {})
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const totpConfig = await getTotpConfig()

  if (totpConfig) {
    const challengeToken = await signChallengeToken(ip)
    logAuditEntry({
      adminId: 'admin',
      action: 'login.password_ok_totp_required',
      path: '/api/auth/login',
      method: 'POST',
      details: { ip },
    }).catch(() => {})
    return NextResponse.json({ ok: false, totpRequired: true, challengeToken })
  }

  const token = await signToken(ip)
  const res = NextResponse.json({ ok: true, totpRequired: false })
  res.cookies.set(cookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: cookieMaxAge(),
    path: '/',
  })

  logAuditEntry({
    adminId: 'admin',
    action: 'login.success',
    path: '/api/auth/login',
    method: 'POST',
    details: { ip, totp: false },
  }).catch(() => {})

  return res
}
