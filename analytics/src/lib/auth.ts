import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const COOKIE_NAME = 'kyns_analytics_token'
const TOKEN_EXPIRY = '24h'

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? 'kyns-analytics-dev-secret-change-in-prod'
  return new TextEncoder().encode(secret)
}

export async function signToken(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret())
    return true
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
  return verifyToken(token)
}

export function cookieName(): string {
  return COOKIE_NAME
}

export function checkPassword(input: string): boolean {
  const password = process.env.ANALYTICS_PASSWORD
  if (!password) return false
  return input === password
}
