import { NextRequest, NextResponse } from 'next/server'
import { getDAU, getWAU, getMAU, getRetentionRates, getCohortAnalysis, getEngagementStats, getStreakStats } from '@/lib/queries/retention'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  try {
    const [dau, wau, mau, rates, cohort, engagement, streaks] = await Promise.all([
      getDAU(days),
      getWAU(12),
      getMAU(6),
      getRetentionRates(),
      getCohortAnalysis(),
      getEngagementStats(7),
      getStreakStats(),
    ])
    return NextResponse.json({ dau, wau, mau, rates, cohort, engagement, streaks })
  } catch (err) {
    console.error('[API/retention]', err)
    return NextResponse.json({ error: 'Failed to fetch retention metrics' }, { status: 500 })
  }
}
