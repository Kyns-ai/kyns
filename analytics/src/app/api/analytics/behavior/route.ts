import { NextRequest, NextResponse } from 'next/server'
import { getTopFirstMessageWords, getMessageLengthDistribution, getConversationStats, getNewUserActivityByHour } from '@/lib/queries/behavior'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  try {
    const [words, lengths, convoStats, signupHours] = await Promise.all([
      getTopFirstMessageWords(50),
      getMessageLengthDistribution(),
      getConversationStats(days),
      getNewUserActivityByHour(days),
    ])
    return NextResponse.json({ words, lengths, convoStats, signupHours })
  } catch (err) {
    console.error('[API/behavior]', err)
    return NextResponse.json({ error: 'Failed to fetch behavior metrics' }, { status: 500 })
  }
}
