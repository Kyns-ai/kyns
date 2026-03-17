import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getLatencyOverview } from '@/lib/queries/latency'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!await isAuthenticated(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const days = Number(req.nextUrl.searchParams.get('days') ?? 1)
    const data = await getLatencyOverview(days)
    return NextResponse.json(data)
  } catch (e) {
    console.error('[API /analytics/latency]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
