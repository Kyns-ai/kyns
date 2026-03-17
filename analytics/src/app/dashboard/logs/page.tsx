'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import Pagination from '@/components/ui/Pagination'
import type { ErrorLog } from '@/lib/queries/admin-logs'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const ERROR_TYPES = [
  { value: '', label: 'Todos' },
  { value: 'error', label: 'Erros' },
  { value: 'thinking_leak', label: 'Thinking Leaks' },
  { value: 'looping', label: 'Loops' },
  { value: 'timeout', label: 'Timeouts' },
  { value: 'prompt_injection', label: 'Prompt Injection' },
]

const TYPE_COLORS: Record<string, string> = {
  error: 'text-red-400 bg-red-500/10',
  thinking_leak: 'text-orange-400 bg-orange-500/10',
  looping: 'text-yellow-400 bg-yellow-500/10',
  timeout: 'text-blue-400 bg-blue-500/10',
  prompt_injection: 'text-pink-400 bg-pink-500/10',
}

const TYPE_LABELS: Record<string, string> = {
  error: 'Erro',
  thinking_leak: 'Thinking Leak',
  looping: 'Loop',
  timeout: 'Timeout',
  prompt_injection: 'Injection',
}

export default function LogsPage() {
  const [type, setType] = useState('')
  const [userId, setUserId] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({ type, userId, conversationId, page: String(page), limit: '50' })
  const { data } = useSWR<{ logs: ErrorLog[]; total: number }>(
    `/api/admin/logs?${params}`,
    fetcher,
    { keepPreviousData: true }
  )

  const typeCount = data?.logs.reduce((acc: Record<string, number>, l) => {
    acc[l.errorType] = (acc[l.errorType] ?? 0) + 1
    return acc
  }, {}) ?? {}

  return (
    <>
      <Header title="Logs e Debugging" />

      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {['error', 'thinking_leak', 'looping', 'timeout', 'prompt_injection'].map((t) => (
            <button
              key={t}
              onClick={() => { setType(type === t ? '' : t); setPage(1) }}
              className={`p-4 rounded-xl border text-left transition-colors ${
                type === t ? 'border-accent/50 bg-accent/5' : 'border-white/5 bg-white/3 hover:border-white/10'
              }`}
            >
              <p className={`text-xs font-medium mb-1 ${TYPE_COLORS[t]?.split(' ')[0]}`}>{TYPE_LABELS[t]}</p>
              <p className="text-2xl font-bold text-white">{typeCount[t] ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">nos últimos resultados</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex gap-1">
            {ERROR_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { setType(t.value); setPage(1) }}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  type === t.value ? 'bg-accent text-white' : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >{t.label}</button>
            ))}
          </div>
          <input
            value={userId}
            onChange={(e) => { setUserId(e.target.value); setPage(1) }}
            placeholder="Filtrar por User ID…"
            className="bg-surface-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <input
            value={conversationId}
            onChange={(e) => { setConversationId(e.target.value); setPage(1) }}
            placeholder="Filtrar por Conversation ID…"
            className="bg-surface-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Log table */}
        <SectionCard
          title={`Logs ${data ? `(${data.total})` : ''}`}
          subtitle="Mensagens com erro, thinking leak, looping ou timeout"
        >
          {!data && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          )}

          <div className="space-y-2">
            {data?.logs.map((log) => (
              <div key={`${log._id}-${log.errorType}`} className="p-3 bg-white/3 rounded-lg border border-white/5 hover:border-white/10">
                <div className="flex items-start gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 mt-0.5 ${TYPE_COLORS[log.errorType] ?? ''}`}>
                    {TYPE_LABELS[log.errorType]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <code className="bg-white/5 px-1 rounded">conv:{log.conversationId.substring(0, 12)}…</code>
                      <code className="bg-white/5 px-1 rounded">user:{log.userId.substring(0, 12)}…</code>
                      <span>{log.endpoint}</span>
                      <span>{log.model}</span>
                      <span className="ml-auto">{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono leading-relaxed truncate">
                      {log.snippet || '(sem conteúdo)'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data?.logs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">Nenhum log encontrado com esses filtros</p>
            </div>
          )}

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
