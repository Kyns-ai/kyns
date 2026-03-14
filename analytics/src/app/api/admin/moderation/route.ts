import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getModerationFeed, flagConversation, getCsamBlockStats } from '@/lib/queries/admin-logs'
import { getAllConfig } from '@/lib/queries/admin-config'

export async function GET(req: NextRequest)  {
  try {
    if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = req.nextUrl
    const config = await getAllConfig()

    const [data, csamStats] = await Promise.all([
      getModerationFeed({
        status: searchParams.get('status') ?? 'pending',
        limit: Number(searchParams.get('limit') ?? 50),
        page: Number(searchParams.get('page') ?? 1),
        keywords: (config as unknown as Record<string, unknown>).moderationKeywords as string[] | undefined,
      }),
      getCsamBlockStats(7),
    ])
    return NextResponse.json({ ...data, csamStats })

  } catch (e) {
    console.error('[API]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest)  {
  try {
    if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { conversationId, reason, userId } = await req.json() as { conversationId: string; reason: string; userId: string }
    await flagConversation(conversationId, reason, userId)
    return NextResponse.json({ ok: true })

  } catch (e) {
    console.error('[API]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
