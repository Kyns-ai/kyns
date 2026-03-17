import { NextRequest, NextResponse } from 'next/server'
import { getActivationFunnel, getTimeToFirstMessage, getActivationRate } from '@/lib/queries/funnel'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  try {
    const [funnel, timeToFirst, activation] = await Promise.all([
      getActivationFunnel(days),
      getTimeToFirstMessage(),
      getActivationRate(days),
    ])
    return NextResponse.json({ funnel, timeToFirst, activation })
  } catch (err) {
    console.error('[API/funnel]', err)
    return NextResponse.json({ error: 'Failed to fetch funnel metrics' }, { status: 500 })
  }
}
