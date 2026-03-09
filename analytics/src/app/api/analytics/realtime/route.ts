import { NextResponse } from 'next/server'
import { getRealtimeMetrics } from '@/lib/queries/realtime'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getRealtimeMetrics()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[API/realtime]', err)
    return NextResponse.json({ error: 'Failed to fetch realtime metrics' }, { status: 500 })
  }
}
