'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import { statusBadge } from '@/components/ui/Badge'
import Pagination from '@/components/ui/Pagination'
import type { ModerationItem, CsamBlockStats } from '@/lib/queries/admin-logs'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ModerationPage() {
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState('')

  const { data, mutate } = useSWR<{ items: ModerationItem[]; total: number; csamStats?: CsamBlockStats }>(
    `/api/admin/moderation?status=${status}&page=${page}&limit=50`,
    fetcher,
    { refreshInterval: 60_000 }
  )

  const doAction = async (item: ModerationItem, action: string) => {
    const body: Record<string, unknown> = {}
    if (action === 'approve') body.status = 'reviewed'
    else if (action === 'ignore') body.status = 'ignored'
    else if (action === 'ban') { body.action = 'ban_user'; body.userId = item.userId; body.status = 'reviewed' }

    await fetch(`/api/admin/moderation/${item._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setToast(action === 'ban' ? 'Usuário banido' : 'Item atualizado')
    setTimeout(() => setToast(''), 2500)
    mutate()
  }

  return (
    <>
      <Header title="Moderação de Conteúdo" />
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Bloqueios hoje" value={data?.csamStats?.blocksToday ?? '—'} accent />
          <StatCard label="Bloqueios 7d" value={data?.csamStats?.blocks7d ?? '—'} />
          <StatCard label="Taxa de bloqueio" value={`${data?.csamStats?.blockRatePct ?? '—'}%`} sub="% do total de msgs" />
        </div>

        <div className="flex gap-2">
          {['pending', 'reviewed', 'ignored', 'all'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1) }}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                status === s ? 'bg-accent text-white' : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {s === 'pending' ? 'Pendentes' : s === 'reviewed' ? 'Revisados' : s === 'ignored' ? 'Ignorados' : 'Todos'}
            </button>
          ))}
        </div>

        <SectionCard
          title={`Fila de Moderação ${data ? `(${data.total})` : ''}`}
          subtitle="Conversas flaggadas para revisão"
        >
          {!data && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {data?.items.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">Nenhuma conversa nesta fila</p>
            </div>
          )}

          <div className="space-y-3">
            {data?.items.map((item) => (
              <div key={item._id} className="p-4 bg-white/3 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {statusBadge(item.status)}
                      <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                        {item.flagReason.replace('_', ' ')}
                      </span>
                      {item.agentId && (
                        <span className="text-xs text-gray-500">Character: {item.agentId.substring(0, 8)}…</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-300">
                      Conv: <code className="text-xs bg-white/5 px-1 rounded">{item.conversationId.substring(0, 12)}…</code>
                      <span className="mx-2 text-gray-600">|</span>
                      User: <code className="text-xs bg-white/5 px-1 rounded">{item.userId.substring(0, 12)}…</code>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(item.createdAt).toLocaleString('pt-BR')} • {item.messageCount} msgs • {item.endpoint}
                    </div>
                  </div>

                  {item.status === 'pending' && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => doAction(item, 'ignore')}
                        className="text-xs px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded"
                      >Ignorar</button>
                      <button
                        onClick={() => doAction(item, 'approve')}
                        className="text-xs px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded"
                      >OK</button>
                      <button
                        onClick={() => doAction(item, 'ban')}
                        className="text-xs px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded"
                      >Banir user</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={page}
            pages={Math.ceil((data?.total ?? 0) / 50)}
            total={data?.total ?? 0}
            limit={50}
            onChange={setPage}
          />
        </SectionCard>
      </div>
    </>
  )
}
