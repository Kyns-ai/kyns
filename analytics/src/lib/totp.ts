import { createHash, randomBytes } from 'crypto'
import * as OTPAuth from 'otpauth'
import { getCollection } from './mongodb'

const BACKUP_CODE_COUNT = 8
const BACKUP_CODE_LENGTH = 8
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface TotpConfig {
  secret: string
  backupCodesHashed: string[]
  configuredAt: Date
}

export interface TotpPending {
  secret: string
  backupCodes: string[]
  createdAt: Date
}

function createTotp(secret: OTPAuth.Secret): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: 'KYNS Analytics',
    label: 'admin',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })
}

export function generateTotpSecret(): { secret: string; uri: string } {
  const secret = new OTPAuth.Secret()
  const totp = createTotp(secret)
  return { secret: secret.base32, uri: totp.toString() }
}

export function validateTotpCode(secretBase32: string, code: string): boolean {
  const secret = OTPAuth.Secret.fromBase32(secretBase32)
  const totp = createTotp(secret)
  const delta = totp.validate({ token: code, window: 1 })
  return delta !== null
}

export function generateBackupCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const bytes = randomBytes(BACKUP_CODE_LENGTH)
    let code = ''
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += SAFE_CHARS[bytes[j] % SAFE_CHARS.length]
    }
    codes.push(code)
  }
  return codes
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase()).digest('hex')
}

export async function getTotpConfig(): Promise<TotpConfig | null> {
  const col = await getCollection('kyns_config')
  const doc = await col.findOne({ key: 'totp_config' })
  if (!doc) return null
  const val = (doc as Record<string, unknown>).value as Record<string, unknown>
  return {
    secret: String(val.secret ?? ''),
    backupCodesHashed: (val.backupCodesHashed as string[]) ?? [],
    configuredAt: (val.configuredAt as Date) ?? new Date(),
  }
}

export async function getTotpPending(): Promise<TotpPending | null> {
  const col = await getCollection('kyns_config')
  const doc = await col.findOne({ key: 'totp_pending' })
  if (!doc) return null
  const val = (doc as Record<string, unknown>).value as Record<string, unknown>
  const createdAt = val.createdAt as Date
  if (Date.now() - new Date(createdAt).getTime() > 10 * 60 * 1000) {
    await col.deleteOne({ key: 'totp_pending' })
    return null
  }
  return {
    secret: String(val.secret ?? ''),
    backupCodes: (val.backupCodes as string[]) ?? [],
    createdAt,
  }
}

export async function saveTotpPending(secret: string, backupCodes: string[]): Promise<void> {
  const col = await getCollection('kyns_config')
  await col.updateOne(
    { key: 'totp_pending' },
    { $set: { key: 'totp_pending', value: { secret, backupCodes, createdAt: new Date() }, updatedAt: new Date() } },
    { upsert: true }
  )
}

export async function confirmTotp(secret: string, backupCodes: string[]): Promise<void> {
  const col = await getCollection('kyns_config')
  const hashedCodes = backupCodes.map((c) => hashCode(c))
  await col.updateOne(
    { key: 'totp_config' },
    {
      $set: {
        key: 'totp_config',
        value: { secret, backupCodesHashed: hashedCodes, configuredAt: new Date() },
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  )
  await col.deleteOne({ key: 'totp_pending' })
}

export async function consumeBackupCode(inputCode: string): Promise<boolean> {
  const config = await getTotpConfig()
  if (!config) return false
  const hashed = hashCode(inputCode)
  const idx = config.backupCodesHashed.indexOf(hashed)
  if (idx === -1) return false
  const col = await getCollection('kyns_config')
  const newCodes = config.backupCodesHashed.filter((c) => c !== hashed)
  await col.updateOne(
    { key: 'totp_config' },
    { $set: { 'value.backupCodesHashed': newCodes } }
  )
  return true
}

export async function deleteTotpConfig(): Promise<void> {
  const col = await getCollection('kyns_config')
  await col.deleteOne({ key: 'totp_config' })
  await col.deleteOne({ key: 'totp_pending' })
}

export function isBackupCode(code: string): boolean {
  return /^[A-Z2-9]{8}$/i.test(code)
}

export function isTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}
