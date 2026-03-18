'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import StatCard from '@/components/ui/StatCard'
import Pagination from '@/components/ui/Pagination'
import KLineChart from '@/components/charts/KLineChart'
import KBarChart from '@/components/charts/KBarChart'
import KPieChart from '@/components/charts/KPieChart'
import LoadingChart from '@/components/ui/LoadingChart'
import type { SecurityOverview, ViolationRecord } from '@/lib/queries/security'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const TYPE_COLORS: Record<string, string> = {
  MESSAGE_LIMIT: 'text-red-400 bg-red-500/10',
  LOGINS: 'text-orange-400 bg-orange-500/10',
  REGISTRATIONS: 'text-yellow-400 bg-yellow-500/10',
  CONCURRENT: 'text-blue-400 bg-blue-500/10',
  TOKEN_BALANCE: 'text-purple-400 bg-purple-500/10',
  ILLEGAL_MODEL_REQUEST: 'text-pink-400 bg-pink-500/10',
  NON_BROWSER: 'text-cyan-400 bg-cyan-500/10',
  FILE_UPLOAD_LIMIT: 'text-amber-400 bg-amber-500/10',
  TOOL_CALL_LIMIT: 'text-emerald-400 bg-emerald-500/10',
}

function typeLabel(t: string): string {
  const map: Record<string, string> = {
    MESSAGE_LIMIT: 'Limite de Msgs',
    LOGINS: 'Login',
    REGISTRATIONS: 'Registro',
    CONCURRENT: 'Concorrência',
    TOKEN_BALANCE: 'Saldo de Tokens',
    ILLEGAL_MODEL_REQUEST: 'Modelo Ilegal',
    NON_BROWSER: 'Non-Browser',
    FILE_UPLOAD_LIMIT: 'Upload',
    TOOL_CALL_LIMIT: 'Tool Call',
    TTS_LIMIT: 'TTS',
    STT_LIMIT: 'STT',
    CONVO_ACCESS: 'Acesso Conversa',
    BAN: 'Ban',
  }
  return map[t] ?? t
}

export default function SecurityPage() {
  const [tab, setTab] = useState<'overview' | 'list'>('overview')
  const [filterType, setFilterType] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [page, setPage] = useState(1)

  const { data: overview } = useSWR<SecurityOverview>(
    '/api/admin/security?view=overview&days=7',
    fetcher,
    { refreshInterval: 60_000 }
  )

  const listParams = new URLSearchParams({
    view: 'list',
    type: filterType,
    userId: filterUser,
    page: String(page),
    limit: '50',
  })
  const { data: listData } = useSWR<{ violations: ViolationRecord[]; total: number }>(
    tab === 'list' ? `/api/admin/security?${listParams}` : null,
    fetcher,
    { keepPreviousData: true }
  )

  return (
    <>
      <Header title="Seguranca e Violacoes" />

      <div className="p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1">
          {(['overview', 'list'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1) }}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                tab === t ? 'bg-accent text-white' : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {t === 'overview' ? 'Visao Geral' : 'Lista de Violacoes'}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Violacoes 24h" value={overview?.totalViolations24h ?? '...'} accent />
              <StatCard label="Violacoes 7d" value={overview?.totalViolations7d ?? '...'} />
              <StatCard label="Usuarios unicos 24h" value={overview?.uniqueUsers24h ?? '...'} />
              <StatCard label="Usuarios banidos" value={overview?.bannedUsers ?? '...'} />
            </div>

            {/* Violations per hour */}
            <SectionCard title="Violacoes por hora" subtitle="Ultimas 24h">
              {!overview ? <LoadingChart /> : (
                <KLineChart
                  data={overview.violationsPerHour}
                  xKey="hour"
                  series={[{ key: 'count', label: 'Violacoes', color: '#ef4444' }]}
                />
              )}
            </SectionCard>

            {/* Two columns: type breakdown + top offenders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SectionCard title="Por tipo" subtitle="Distribuicao 7d">
                {!overview ? <LoadingChart height={250} /> : (
                  <KPieChart
                    data={(overview.topTypes ?? []).map((t) => ({
                      name: typeLabel(t.type),
                      value: t.count,
                    }))}
                    height={250}
                  />
                )}
              </SectionCard>

              <SectionCard title="Top infratores" subtitle="Usuarios com mais violacoes">
                {!overview ? <LoadingChart height={250} /> : (
                  <KBarChart
                    data={(overview.topOffenders ?? []).slice(0, 8).map((o) => ({
                      name: o.userId.substring(0, 12) + '...',
                      count: o.count,
                    }))}
                    xKey="name"
                    barKey="count"
                    horizontal
                    height={250}
                    color="#ef4444"
                    label="Violacoes"
                  />
                )}
              </SectionCard>
            </div>

            {/* Registration spikes */}
            <SectionCard title="Registros por dia" subtitle="Picos podem indicar bots ou campanhas">
              {!overview ? <LoadingChart /> : (
                <KBarChart
                  data={overview.suspiciousRegistrations ?? []}
                  xKey="date"
                  barKey="count"
                  color="#7c3aed"
                  label="Novos registros"
                />
              )}
            </SectionCard>
          </>
        )}

        {tab === 'list' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value); setPage(1) }}
                className="bg-surface-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Todos os tipos</option>
                {Object.keys(TYPE_COLORS).map((t) => (
                  <option key={t} value={t}>{typeLabel(t)}</option>
                ))}
              </select>
              <input
                value={filterUser}
                onChange={(e) => { setFilterUser(e.target.value); setPage(1) }}
                placeholder="Filtrar por User ID..."
                className="bg-surface-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Violations table */}
            <SectionCard
              title={`Violacoes ${listData ? `(${listData.total})` : ''}`}
              subtitle="Todas as violacoes registradas"
            >
              {!listData && (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-14 bg-white/5 rounded animate-pulse" />
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {listData?.violations.map((v) => (
                  <div key={v._id} className="p-3 bg-white/3 rounded-lg border border-white/5 hover:border-white/10">
                    <div className="flex items-start gap-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 mt-0.5 ${TYPE_COLORS[v.type] ?? 'text-gray-400 bg-white/5'}`}>
                        {typeLabel(v.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                          <code className="bg-white/5 px-1 rounded">user:{v.userId.substring(0, 16)}...</code>
                          <span>score: {v.score}</span>
                          <span>total: {v.violationCount}</span>
                          {v.ip && <code className="bg-white/5 px-1 rounded">ip:{v.ip}</code>}
                          <span className="ml-auto">{new Date(v.createdAt).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {listData?.violations.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-sm">Nenhuma violacao encontrada</p>
                </div>
              )}

              <Pagination
                page={page}
                pages={Math.ceil((listData?.total ?? 0) / 50)}
                total={listData?.total ?? 0}
                limit={50}
                onChange={setPage}
              />
            </SectionCard>
          </>
        )}
      </div>
    </>
  )
}
