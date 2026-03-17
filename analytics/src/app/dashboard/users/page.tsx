'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import ExportButton from '@/components/ui/ExportButton'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import { statusBadge } from '@/components/ui/Badge'
import type { AdminUser } from '@/lib/queries/admin-users'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('createdAt')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const [actionModal, setActionModal] = useState<{ user: AdminUser; action: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  const query = new URLSearchParams({ search, status, sort, order, page: String(page), limit: '50' }).toString()
  const { data, mutate } = useSWR<{ users: AdminUser[]; total: number; pages: number }>(
    `/api/admin/users?${query}`,
    fetcher,
    { keepPreviousData: true }
  )
  const { data: suspicious } = useSWR('/api/admin/users?suspicious=true', fetcher)

  const doAction = useCallback(async (userId: string, action: string, extra?: Record<string, unknown>) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      if (res.ok) {
        setToast('Ação executada com sucesso')
        mutate()
        setActionModal(null)
        setTimeout(() => setToast(''), 3000)
      }
    } finally {
      setLoading(false)
    }
  }, [mutate])

  const doDelete = useCallback(async (userId: string) => {
    if (!confirm('Deletar esta conta permanentemente?')) return
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    mutate()
    setSelected(null)
  }, [mutate])

  const toggleSort = (field: string) => {
    if (sort === field) setOrder(order === 'desc' ? 'asc' : 'desc')
    else { setSort(field); setOrder('desc') }
    setPage(1)
  }

  const SortIcon = ({ field }: { field: string }) =>
    sort === field ? (
      <span className="ml-1 text-accent">{order === 'desc' ? '↓' : '↑'}</span>
    ) : (
      <span className="ml-1 text-gray-600">↕</span>
    )

  return (
    <>
      <Header title="Gestão de Usuários" />
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Suspicious users */}
        {suspicious?.length > 0 && (
          <SectionCard title="⚠ Comportamento Suspeito" subtitle="Mais de 50 msgs na última hora">
            <div className="space-y-2">
              {suspicious.map((u: { userId: string; email: string; name: string; msgsLastHour: number }) => (
                <div key={u.userId} className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <div>
                    <span className="text-sm text-white font-medium">{u.name || u.email}</span>
                    <span className="ml-2 text-xs text-yellow-400">{u.msgsLastHour} msgs/hora</span>
                  </div>
                  <button
                    onClick={() => doAction(u.userId, 'ban')}
                    className="text-xs px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded"
                  >Banir</button>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nome ou email…"
            className="flex-1 min-w-48 bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}
            className="bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="banned">Banido</option>
          </select>
          <ExportButton data={data?.users ?? []} filename="users" />
        </div>

        {/* Table */}
        <SectionCard
          title={`Usuários ${data ? `(${data.total})` : ''}`}
          subtitle="Clique em um usuário para ver detalhes e ações"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/5">
                  {[
                    { field: 'name', label: 'Nome' },
                    { field: 'email', label: 'Email' },
                    { field: 'createdAt', label: 'Cadastro' },
                    { field: 'lastActive', label: 'Último acesso' },
                    { field: 'totalMessages', label: 'Msgs' },
                    { field: 'favoriteMode', label: 'Modo fav.' },
                    { field: 'status', label: 'Status' },
                  ].map(({ field, label }) => (
                    <th
                      key={field}
                      className="px-3 py-2.5 text-xs font-medium text-gray-400 cursor-pointer hover:text-white"
                      onClick={() => toggleSort(field)}
                    >
                      {label}<SortIcon field={field} />
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-xs font-medium text-gray-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {!data && Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="h-4 bg-white/5 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
                {data?.users.map((u) => (
                  <tr
                    key={u._id}
                    className="hover:bg-white/3 cursor-pointer"
                    onClick={() => setSelected(u)}
                  >
                    <td className="px-3 py-2.5 text-white font-medium">{u.name || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-400">{u.email}</td>
                    <td className="px-3 py-2.5 text-gray-400">{fmtDate(u.createdAt)}</td>
                    <td className="px-3 py-2.5 text-gray-400">{fmtDate(u.lastActive)}</td>
                    <td className="px-3 py-2.5 text-gray-300">{u.totalMessages.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-gray-400">{u.favoriteMode}</td>
                    <td className="px-3 py-2.5">{statusBadge(u.status)}</td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {u.status !== 'banned' ? (
                          <button
                            onClick={() => setActionModal({ user: u, action: 'ban' })}
                            className="text-xs px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded"
                          >Banir</button>
                        ) : (
                          <button
                            onClick={() => doAction(u._id, 'unban')}
                            className="text-xs px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded"
                          >Desbanir</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pages={data?.pages ?? 1}
            total={data?.total ?? 0}
            limit={50}
            onChange={setPage}
          />
        </SectionCard>
      </div>

      {/* User detail modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalhes do Usuário" size="lg">
        {selected && <UserDetail user={selected} onAction={doAction} onDelete={doDelete} />}
      </Modal>

      {/* Action confirm modal */}
      <Modal
        open={!!actionModal}
        onClose={() => setActionModal(null)}
        title={actionModal?.action === 'ban' ? 'Confirmar Banimento' : 'Confirmar Ação'}
        size="sm"
      >
        {actionModal && (
          <div>
            <p className="text-sm text-gray-300 mb-4">
              {actionModal.action === 'ban'
                ? `Banir ${actionModal.user.name || actionModal.user.email}? Eles não poderão acessar a plataforma.`
                : 'Confirmar esta ação?'}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setActionModal(null)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Cancelar</button>
              <button
                disabled={loading}
                onClick={() => doAction(actionModal.user._id, actionModal.action)}
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {loading ? 'Processando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

function UserDetail({ user, onAction, onDelete }: {
  user: AdminUser
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const { data: convs } = useSWR(`/api/admin/users/${user._id}?conversations=true`, fetcher)
  const [credits, setCredits] = useState('')
  const [plan, setPlan] = useState(user.plan)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          ['Email', user.email],
          ['Provedor', user.provider],
          ['Cadastro', new Date(user.createdAt).toLocaleDateString('pt-BR')],
          ['Último acesso', user.lastActive ? new Date(user.lastActive).toLocaleDateString('pt-BR') : '—'],
          ['Total de msgs', user.totalMessages.toLocaleString()],
          ['Modo favorito', user.favoriteMode],
          ['Role', user.role],
          ['Créditos', user.balance.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label}>
            <span className="text-gray-500 text-xs">{label}</span>
            <p className="text-white">{String(value)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {user.status !== 'banned'
          ? <button onClick={() => onAction(user._id, 'ban')} className="px-3 py-1.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/40 rounded-lg">Banir</button>
          : <button onClick={() => onAction(user._id, 'unban')} className="px-3 py-1.5 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 rounded-lg">Desbanir</button>
        }
        <select
          value={plan}
          onChange={(e) => { setPlan(e.target.value); onAction(user._id, 'update', { plan: e.target.value }) }}
          className="px-2 py-1.5 text-xs bg-surface-800 border border-white/10 rounded-lg text-white"
        >
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="business">Business</option>
        </select>
        <div className="flex gap-1">
          <input
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="Créditos"
            className="w-24 px-2 py-1.5 text-xs bg-surface-800 border border-white/10 rounded-lg text-white"
          />
          <button
            onClick={() => credits && onAction(user._id, 'update', { tokenBalance: Number(credits) })}
            className="px-2 py-1.5 text-xs bg-accent/20 text-accent hover:bg-accent/30 rounded-lg"
          >Salvar</button>
        </div>
        <button onClick={() => onDelete(user._id)} className="px-3 py-1.5 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg ml-auto">Deletar conta</button>
      </div>

      {convs && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Conversas recentes</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {convs.map((c: { conversationId: string; endpoint: string; title: string; createdAt: string; messageCount: number }) => (
              <div key={c.conversationId} className="flex items-center justify-between p-2 bg-white/3 rounded text-xs">
                <span className="text-gray-300 truncate max-w-xs">{c.title || 'Sem título'}</span>
                <div className="flex gap-2 shrink-0">
                  <span className="text-gray-500">{c.endpoint}</span>
                  <span className="text-gray-500">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                  <span className="text-gray-400">{c.messageCount} msgs</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
