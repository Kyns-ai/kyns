import { NextRequest, NextResponse } from 'next/server'
import { getDAU, getWAU, getMAU, getRetentionRates, getCohortAnalysis, getEngagementStats } from '@/lib/queries/retention'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  try {
    const [dau, wau, mau, rates, cohort, engagement] = await Promise.all([
      getDAU(days),
      getWAU(12),
      getMAU(6),
      getRetentionRates(),
      getCohortAnalysis(),
      getEngagementStats(7),
    ])
    return NextResponse.json({ dau, wau, mau, rates, cohort, engagement })
  } catch (err) {
    console.error('[API/retention]', err)
    return NextResponse.json({ error: 'Failed to fetch retention metrics' }, { status: 500 })
  }
}
