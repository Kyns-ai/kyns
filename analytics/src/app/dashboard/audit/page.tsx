'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import Pagination from '@/components/ui/Pagination'
import type { AuditEntry } from '@/lib/queries/audit'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400 bg-emerald-500/10',
  POST: 'text-blue-400 bg-blue-500/10',
  PUT: 'text-yellow-400 bg-yellow-500/10',
  PATCH: 'text-orange-400 bg-orange-500/10',
  DELETE: 'text-red-400 bg-red-500/10',
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    'user.update': 'Atualizou usuario',
    'user.ban': 'Baniu usuario',
    'user.delete': 'Deletou usuario',
    'config.update': 'Atualizou config',
    'alert.update': 'Atualizou alertas',
    'moderation.review': 'Revisou moderacao',
    'character.update': 'Atualizou character',
    'character.create': 'Criou character',
    'infrastructure.check': 'Checou infra',
  }
  return map[action] ?? action
}

export default function AuditPage() {
  const [filterAction, setFilterAction] = useState('')
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({
    action: filterAction,
    page: String(page),
    limit: '50',
  })
  const { data } = useSWR<{ entries: AuditEntry[]; total: number }>(
    `/api/admin/audit?${params}`,
    fetcher,
    { keepPreviousData: true }
  )

  return (
    <>
      <Header title="Audit Log" />

      <div className="p-6 space-y-6">
        {/* Info banner */}
        <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl">
          <p className="text-sm text-accent font-medium">Registro de acoes administrativas</p>
          <p className="text-xs text-gray-400 mt-1">
            Todas as acoes realizadas no painel admin sao registradas aqui para compliance e auditoria.
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1) }}
            className="bg-surface-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">Todas as acoes</option>
            <option value="user.update">Atualizar usuario</option>
            <option value="user.ban">Banir usuario</option>
            <option value="user.delete">Deletar usuario</option>
            <option value="config.update">Atualizar config</option>
            <option value="alert.update">Atualizar alertas</option>
            <option value="moderation.review">Revisar moderacao</option>
            <option value="character.update">Atualizar character</option>
          </select>
        </div>

        {/* Entries */}
        <SectionCard
          title={`Eventos ${data ? `(${data.total})` : ''}`}
          subtitle="Acoes administrativas em ordem cronologica"
        >
          {!data && (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          )}

          <div className="space-y-2">
            {data?.entries.map((entry) => (
              <div key={entry._id} className="p-3 bg-white/3 rounded-lg border border-white/5 hover:border-white/10">
                <div className="flex items-start gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 mt-0.5 ${METHOD_COLORS[entry.method] ?? 'text-gray-400 bg-white/5'}`}>
                    {entry.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-white font-medium">{actionLabel(entry.action)}</span>
                      {entry.targetId && (
                        <code className="text-xs bg-white/5 px-1 rounded text-gray-400">
                          target:{entry.targetId.substring(0, 12)}...
                        </code>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <code className="bg-white/5 px-1 rounded">{entry.path}</code>
                      <span className="ml-auto">{new Date(entry.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    {entry.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">Detalhes</summary>
                        <pre className="text-xs text-gray-500 font-mono mt-1 bg-white/3 p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {data?.entries.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">Nenhum evento registrado</p>
              <p className="text-xs mt-1">Acoes admin serao registradas automaticamente aqui</p>
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
