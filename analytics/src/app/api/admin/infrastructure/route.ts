import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getInfrastructureStatus } from '@/lib/queries/admin-infrastructure'

export async function GET(req: NextRequest)  {
  try {
    if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const data = await getInfrastructureStatus()
    return NextResponse.json(data)

  } catch (e) {
    console.error('[API]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
