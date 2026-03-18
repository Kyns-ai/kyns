import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getErrorLogs } from '@/lib/queries/admin-logs'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!await isAuthenticated(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = req.nextUrl
    const data = await getErrorLogs({
      type: searchParams.get('type') || undefined,
      userId: searchParams.get('userId') || undefined,
      conversationId: searchParams.get('conversationId') || undefined,
      limit: Number(searchParams.get('limit') ?? 50),
      page: Number(searchParams.get('page') ?? 1),
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[API /admin/logs]', e)
    return NextResponse.json({ logs: [], total: 0 })
  }
}
