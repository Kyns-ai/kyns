import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getAuditLog } from '@/lib/queries/audit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    if (!await isAuthenticated(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = req.nextUrl
    const data = await getAuditLog({
      action: searchParams.get('action') || undefined,
      adminId: searchParams.get('adminId') || undefined,
      limit: Number(searchParams.get('limit') ?? 50),
      page: Number(searchParams.get('page') ?? 1),
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[API /admin/audit]', e)
    return NextResponse.json({ entries: [], total: 0 })
  }
}
