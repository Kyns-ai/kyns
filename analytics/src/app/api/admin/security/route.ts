import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSecurityOverview, getViolationsPaginated } from '@/lib/queries/security'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!await isAuthenticated(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = req.nextUrl
    const view = searchParams.get('view') ?? 'overview'

    if (view === 'list') {
      const data = await getViolationsPaginated({
        type: searchParams.get('type') || undefined,
        userId: searchParams.get('userId') || undefined,
        limit: Number(searchParams.get('limit') ?? 50),
        page: Number(searchParams.get('page') ?? 1),
      })
      return NextResponse.json(data)
    }

    const days = Number(searchParams.get('days') ?? 7)
    const data = await getSecurityOverview(days)
    return NextResponse.json(data)
  } catch (e) {
    console.error('[API /admin/security]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
