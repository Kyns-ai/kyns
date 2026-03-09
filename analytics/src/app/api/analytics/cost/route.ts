import { NextRequest, NextResponse } from 'next/server'
import { getCostPerDay, getCostSummary, getCostByEndpoint } from '@/lib/queries/cost'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  try {
    const [daily, summary, byEndpoint] = await Promise.all([
      getCostPerDay(days),
      getCostSummary(days),
      getCostByEndpoint(days),
    ])
    return NextResponse.json({ daily, summary, byEndpoint })
  } catch (err) {
    console.error('[API/cost]', err)
    return NextResponse.json({ error: 'Failed to fetch cost metrics' }, { status: 500 })
  }
}
