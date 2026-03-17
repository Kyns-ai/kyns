import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'

const COOKIE_NAME = 'kyns_analytics_token'
const TOKEN_EXPIRY = '4h'
const COOKIE_MAX_AGE = 14400
const CHALLENGE_EXPIRY = '5m'

interface TokenPayload {
  admin: boolean
  ip: string
}

interface ChallengePayload {
  challenge: boolean
  ip: string
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production')
    }
    return new TextEncoder().encode('kyns-analytics-dev-secret-change-in-prod')
  }
  return new TextEncoder().encode(secret)
}

export function extractIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.ip ?? 'unknown'
}

export async function signToken(ip: string): Promise<string> {
  return new SignJWT({ admin: true, ip } satisfies TokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecret())
}

export async function signChallengeToken(ip: string): Promise<string> {
  return new SignJWT({ challenge: true, ip } satisfies ChallengePayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(CHALLENGE_EXPIRY)
    .sign(getSecret())
}

export async function verifyTokenPayload(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.admin !== true || typeof payload.ip !== 'string') return null
    return { admin: true, ip: payload.ip as string }
  } catch {
    return null
  }
}

export async function verifyChallengeToken(token: string, expectedIp: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    if (payload.challenge !== true) return false
    return payload.ip === expectedIp
  } catch {
    return false
  }
}

export async function getTokenFromRequest(req: NextRequest): Promise<string | null> {
  return req.cookies.get(COOKIE_NAME)?.value ?? null
}

export async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const token = await getTokenFromRequest(req)
  if (!token) return false
  const payload = await verifyTokenPayload(token)
  if (!payload) return false
  const currentIp = extractIp(req)
  return payload.ip === currentIp
}

export function cookieName(): string {
  return COOKIE_NAME
}

export function cookieMaxAge(): number {
  return COOKIE_MAX_AGE
}

export function checkPassword(input: string): boolean {
  const password = process.env.ANALYTICS_PASSWORD
  if (!password) return false
  return input === password
}
