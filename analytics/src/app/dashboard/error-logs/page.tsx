'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import Pagination from '@/components/ui/Pagination'
import type { SystemErrorLog, ErrorLogStats } from '@/lib/queries/error-logs'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const SOURCE_STYLES: Record<string, { label: string; color: string }> = {
  backend: { label: 'Backend', color: 'text-blue-400 bg-blue-500/10' },
  backend_http: { label: 'HTTP', color: 'text-orange-400 bg-orange-500/10' },
  runpod: { label: 'RunPod', color: 'text-purple-400 bg-purple-500/10' },
  frontend: { label: 'Frontend', color: 'text-red-400 bg-red-500/10' },
  analytics_dashboard: { label: 'Dashboard', color: 'text-yellow-400 bg-yellow-500/10' },
}

const LEVEL_STYLES: Record<string, string> = {
  error: 'text-red-400 bg-red-500/10',
  warn: 'text-yellow-400 bg-yellow-500/10',
}

function sourceStyle(source: string) {
  return SOURCE_STYLES[source] ?? { label: source, color: 'text-gray-400 bg-white/5' }
}

export default function ErrorLogsPage() {
  const [filterSource, setFilterSource] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({
    source: filterSource,
    level: filterLevel,
    search,
    page: String(page),
    limit: '50',
  })

  const { data } = useSWR<{ logs: SystemErrorLog[]; total: number }>(
    `/api/admin/error-logs?${params}`,
    fetcher,
    { keepPreviousData: true, refreshInterval: 30000 }
  )

  const { data: stats } = useSWR<ErrorLogStats>(
    '/api/admin/error-logs?stats=true',
    fetcher,
    { refreshInterval: 30000 }
  )

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  return (
    <>
      <Header title="Error Logs" />

      <div className="p-6 space-y-6">
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <button
              onClick={() => { setFilterSource(''); setPage(1) }}
              className={`p-3 rounded-xl border transition-colors text-left ${!filterSource ? 'border-accent/40 bg-accent/5' : 'border-white/5 bg-white/3 hover:border-white/10'}`}
            >
              <p className="text-xs text-gray-400">Total 24h</p>
              <p className="text-xl font-bold text-white">{stats.totalLast24h}</p>
            </button>
            {Object.entries(SOURCE_STYLES).map(([key, { label, color }]) => (
              <button
                key={key}
                onClick={() => { setFilterSource(filterSource === key ? '' : key); setPage(1) }}
                className={`p-3 rounded-xl border transition-colors text-left ${filterSource === key ? 'border-accent/40 bg-accent/5' : 'border-white/5 bg-white/3 hover:border-white/10'}`}
              >
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-xl font-bold ${color.split(' ')[0]}`}>
                  {stats.bySource[key] ?? 0}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={filterSource}
            onChange={(e) => { setFilterSource(e.target.value); setPage(1) }}
            className="bg-surface-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Todas as fontes</option>
            {Object.entries(SOURCE_STYLES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filterLevel}
            onChange={(e) => { setFilterLevel(e.target.value); setPage(1) }}
            className="bg-surface-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Todos os niveis</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
          </select>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar mensagem..."
              className="bg-surface-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-accent w-56"
            />
            <button
              type="submit"
              className="bg-accent/15 text-accent text-xs px-3 py-1.5 rounded-lg hover:bg-accent/25 transition-colors"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* Logs */}
        <SectionCard
          title={`Erros ${data ? `(${data.total})` : ''}`}
          subtitle="Erros do sistema em ordem cronologica — atualiza a cada 30s"
        >
          {!data && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          )}

          <div className="space-y-2">
            {data?.logs.map((log) => {
              const src = sourceStyle(log.source)
              const lvl = LEVEL_STYLES[log.level] ?? 'text-gray-400 bg-white/5'
              return (
                <div key={log._id} className="p-3 bg-white/3 rounded-lg border border-white/5 hover:border-white/10">
                  <div className="flex items-start gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 mt-0.5 ${src.color}`}>
                      {src.label}
                    </span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${lvl}`}>
                      {log.level}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-mono break-all leading-snug">
                        {log.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        {log.httpStatus && (
                          <code className="bg-white/5 px-1 rounded">{log.httpStatus}</code>
                        )}
                        {log.path && (
                          <code className="bg-white/5 px-1 rounded truncate max-w-xs">{log.path}</code>
                        )}
                        {log.userId && (
                          <code className="bg-white/5 px-1 rounded">user:{log.userId.substring(0, 8)}</code>
                        )}
                        <span className="ml-auto shrink-0">
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {(log.stack || log.metadata) && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">
                            Detalhes
                          </summary>
                          {log.stack && (
                            <pre className="text-xs text-red-400/70 font-mono mt-1 bg-white/3 p-2 rounded overflow-auto max-h-40">
                              {log.stack}
                            </pre>
                          )}
                          {log.metadata && (
                            <pre className="text-xs text-gray-500 font-mono mt-1 bg-white/3 p-2 rounded overflow-auto max-h-32">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {data?.logs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">Nenhum erro encontrado</p>
              <p className="text-xs mt-1">Erros do sistema serao capturados automaticamente</p>
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
