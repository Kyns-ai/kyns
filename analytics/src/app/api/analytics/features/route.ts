import { NextResponse } from 'next/server'
import { getFeatureUsage, getFeatureRetentionCorrelation } from '@/lib/queries/features'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [features, correlation] = await Promise.all([getFeatureUsage(), getFeatureRetentionCorrelation()])
    return NextResponse.json({ features, correlation })
  } catch (err) {
    console.error('[API/features]', err)
    return NextResponse.json({ error: 'Failed to fetch feature metrics' }, { status: 500 })
  }
}
