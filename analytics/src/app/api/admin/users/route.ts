import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getUserList, getSuspiciousUsers } from '@/lib/queries/admin-users'

export async function GET(req: NextRequest) {
  if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = req.nextUrl
    if (searchParams.get('suspicious') === 'true') {
      const data = await getSuspiciousUsers()
      return NextResponse.json(data)
    }
    const data = await getUserList({
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      sort: searchParams.get('sort') || undefined,
      order: (searchParams.get('order') as 'asc' | 'desc') || undefined,
      page: Number(searchParams.get('page') ?? 1),
      limit: Number(searchParams.get('limit') ?? 50),
    })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[API /admin/users]', e)
    return NextResponse.json({ users: [], total: 0, page: 1, pages: 0 }, { status: 200 })
  }
}
