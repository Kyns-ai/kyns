import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getSystemErrorLogs, getErrorLogStats } from '@/lib/queries/error-logs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!await isAuthenticated(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl

    if (searchParams.get('stats') === 'true') {
      const stats = await getErrorLogStats()
      return NextResponse.json(stats)
    }

    const data = await getSystemErrorLogs({
      source: searchParams.get('source') || undefined,
      level: searchParams.get('level') || undefined,
      search: searchParams.get('search') || undefined,
      limit: Number(searchParams.get('limit') ?? 50),
      page: Number(searchParams.get('page') ?? 1),
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[API /admin/error-logs]', e)
    return NextResponse.json({ logs: [], total: 0 })
  }
}
