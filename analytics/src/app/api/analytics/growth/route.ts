import { NextRequest, NextResponse } from 'next/server'
import { getSignupsPerDay, getSignupsPerHour, getWeeklyChurn, getProviderBreakdown } from '@/lib/queries/growth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  try {
    const [signupsDay, signupsHour, churn, providers] = await Promise.all([
      getSignupsPerDay(days),
      getSignupsPerHour(days),
      getWeeklyChurn(8),
      getProviderBreakdown(),
    ])
    return NextResponse.json({ signupsDay, signupsHour, churn, providers })
  } catch (err) {
    console.error('[API/growth]', err)
    return NextResponse.json({ error: 'Failed to fetch growth metrics' }, { status: 500 })
  }
}
