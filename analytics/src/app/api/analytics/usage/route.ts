import { NextRequest, NextResponse } from 'next/server'
import {
  getMessagesPerDay,
  getMessagesByDayHour,
  getEndpointBreakdown,
  getAgentUsage,
  getImagesPerDay,
  getUploadsPerDay,
  getTokensPerDay,
} from '@/lib/queries/usage'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  try {
    const [messagesPerDay, heatmap, endpoints, agents, images, uploads, tokens] = await Promise.all([
      getMessagesPerDay(days),
      getMessagesByDayHour(days),
      getEndpointBreakdown(days),
      getAgentUsage(days),
      getImagesPerDay(days),
      getUploadsPerDay(days),
      getTokensPerDay(days),
    ])
    return NextResponse.json({ messagesPerDay, heatmap, endpoints, agents, images, uploads, tokens })
  } catch (err) {
    console.error('[API/usage]', err)
    return NextResponse.json({ error: 'Failed to fetch usage metrics' }, { status: 500 })
  }
}
