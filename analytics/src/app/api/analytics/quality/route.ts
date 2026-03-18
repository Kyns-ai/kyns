import { NextResponse } from 'next/server'
import { getQualityMetrics, getDailyErrorRate, getThinkingLeakSamples } from '@/lib/queries/quality'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [metrics, errorRates, leaks] = await Promise.all([
      getQualityMetrics(),
      getDailyErrorRate(14),
      getThinkingLeakSamples(3),
    ])
    return NextResponse.json({ metrics, errorRates, leaks })
  } catch (err) {
    console.error('[API/quality]', err)
    return NextResponse.json({ error: 'Failed to fetch quality metrics' }, { status: 500 })
  }
}
