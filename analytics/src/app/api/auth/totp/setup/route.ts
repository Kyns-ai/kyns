import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { isAuthenticated } from '@/lib/auth'
import { getTotpConfig, getTotpPending, generateTotpSecret, generateBackupCodes, saveTotpPending } from '@/lib/totp'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!await isAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await getTotpConfig()
  if (existing) {
    return NextResponse.json({
      configured: true,
      backupCodesRemaining: existing.backupCodesHashed.length,
    })
  }

  const pending = await getTotpPending()
  if (pending) {
    const pendingUri = `otpauth://totp/KYNS%20Analytics:admin?secret=${pending.secret}&issuer=KYNS%20Analytics&algorithm=SHA1&digits=6&period=30`
    const qrDataUrl = await QRCode.toDataURL(pendingUri)
    return NextResponse.json({
      configured: false,
      qrDataUrl,
      secret: pending.secret,
      backupCodes: pending.backupCodes,
    })
  }

  const { secret, uri } = generateTotpSecret()
  const backupCodes = generateBackupCodes()
  await saveTotpPending(secret, backupCodes)

  const qrDataUrl = await QRCode.toDataURL(uri)

  return NextResponse.json({
    configured: false,
    qrDataUrl,
    secret,
    backupCodes,
  })
}
