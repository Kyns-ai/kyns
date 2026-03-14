import { NextRequest, NextResponse } from 'next/server'
import { getCharacterStats, getCharacterRetention, getDeepEngagementStats } from '@/lib/queries/characters'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  try {
    const [stats, retention, deepEngagement] = await Promise.all([
      getCharacterStats(days),
      getCharacterRetention(days),
      getDeepEngagementStats(days),
    ])
    return NextResponse.json({ stats, retention, deepEngagement })
  } catch (err) {
    console.error('[API/characters]', err)
    return NextResponse.json({ error: 'Failed to fetch character metrics' }, { status: 500 })
  }
}
