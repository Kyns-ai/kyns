'use client'

import { useState, useCallback } from 'react'
import useSWR, { mutate } from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface ApiKey {
  id: string
  name: string
  prefix: string
  active: boolean
  createdAt: string
  revokedAt?: string
  lastUsedAt?: string
  requests: number
}

export default function ApiKeysPage() {
  const { data, isLoading } = useSWR('/api/admin/api-keys', fetcher)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [newKey, setNewKey] = useState('')
  const [copied, setCopied] = useState('')
  const [revoking, setRevoking] = useState('')

  const keys: ApiKey[] = data?.keys ?? []
  const activeKeys = keys.filter((k) => k.active)
  const revokedKeys = keys.filter((k) => !k.active)

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (data.key) {
        setNewKey(data.key)
        setName('')
        mutate('/api/admin/api-keys')
      }
    } finally {
      setCreating(false)
    }
  }, [name])

  const handleRevoke = useCallback(async (id: string) => {
    setRevoking(id)
    try {
      await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' })
      mutate('/api/admin/api-keys')
    } finally {
      setRevoking('')
    }
  }, [])

  const handleCopy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }, [])

  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return 'nunca'
    const d = new Date(dateStr)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}m atrás`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h atrás`
    const days = Math.floor(hours / 24)
    return `${days}d atrás`
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">API Keys</h1>
          <p className="text-sm text-gray-400 mt-1">
            Gerencie chaves de acesso para a API do LLM
          </p>
        </div>
        <div className="text-sm text-gray-500">{activeKeys.length} ativas</div>
      </div>

      {/* Create Key */}
      <div className="bg-surface-800 border border-white/5 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-3">Nova API Key</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nome (ex: OpenClaw Mac Mini)"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-accent/50"
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/80 disabled:opacity-40 transition-colors"
          >
            {creating ? 'Criando...' : 'Criar Key'}
          </button>
        </div>

        {/* New key display */}
        {newKey && (
          <div className="mt-4 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <p className="text-xs text-green-400 font-medium mb-2">
              Key criada! Copie agora — ela não será mostrada novamente.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/30 rounded-lg px-3 py-2 text-sm text-green-300 font-mono select-all">
                {newKey}
              </code>
              <button
                onClick={() => handleCopy(newKey, 'new')}
                className="px-3 py-2 bg-green-500/20 text-green-400 text-xs font-medium rounded-lg hover:bg-green-500/30 transition-colors"
              >
                {copied === 'new' ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <button
              onClick={() => setNewKey('')}
              className="mt-2 text-xs text-gray-500 hover:text-gray-300"
            >
              Fechar
            </button>
          </div>
        )}
      </div>

      {/* Usage instructions */}
      <div className="bg-surface-800 border border-white/5 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-2">Como usar</h2>
        <div className="bg-black/30 rounded-lg p-4 font-mono text-xs text-gray-300 space-y-1">
          <p className="text-gray-500"># Python</p>
          <p>from openai import OpenAI</p>
          <p>client = OpenAI(</p>
          <p>{'    '}base_url=<span className="text-accent">&quot;https://ncp20mxcnw5aig-8000.proxy.runpod.net/v1&quot;</span>,</p>
          <p>{'    '}api_key=<span className="text-accent">&quot;sk-kyns-sua-chave-aqui&quot;</span></p>
          <p>)</p>
        </div>
      </div>

      {/* Active Keys */}
      {isLoading ? (
        <div className="bg-surface-800 border border-white/5 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      ) : activeKeys.length === 0 && revokedKeys.length === 0 ? (
        <div className="bg-surface-800 border border-white/5 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">Nenhuma API key criada ainda.</p>
        </div>
      ) : (
        <>
          {activeKeys.length > 0 && (
            <div className="bg-surface-800 border border-white/5 rounded-xl overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white">Keys Ativas</h2>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-white/5">
                    <th className="text-left px-5 py-2.5 font-medium">Nome</th>
                    <th className="text-left px-5 py-2.5 font-medium">Key</th>
                    <th className="text-left px-5 py-2.5 font-medium">Requests</th>
                    <th className="text-left px-5 py-2.5 font-medium">Último uso</th>
                    <th className="text-left px-5 py-2.5 font-medium">Criada</th>
                    <th className="text-right px-5 py-2.5 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {activeKeys.map((k) => (
                    <tr key={k.id} className="border-b border-white/5 last:border-0 hover:bg-white/[.02]">
                      <td className="px-5 py-3">
                        <span className="text-sm text-white font-medium">{k.name}</span>
                      </td>
                      <td className="px-5 py-3">
                        <code className="text-xs text-gray-400 font-mono">{k.prefix}</code>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-gray-300">{k.requests.toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-gray-400">{timeAgo(k.lastUsedAt)}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-gray-400">
                          {new Date(k.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleRevoke(k.id)}
                          disabled={revoking === k.id}
                          className="px-3 py-1.5 text-xs text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                        >
                          {revoking === k.id ? 'Revogando...' : 'Revogar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {revokedKeys.length > 0 && (
            <div className="bg-surface-800 border border-white/5 rounded-xl overflow-hidden opacity-60">
              <div className="px-5 py-3 border-b border-white/5">
                <h2 className="text-sm font-semibold text-gray-400">Revogadas</h2>
              </div>
              <table className="w-full">
                <tbody>
                  {revokedKeys.map((k) => (
                    <tr key={k.id} className="border-b border-white/5 last:border-0">
                      <td className="px-5 py-2.5">
                        <span className="text-sm text-gray-500 line-through">{k.name}</span>
                      </td>
                      <td className="px-5 py-2.5">
                        <code className="text-xs text-gray-600 font-mono">{k.prefix}</code>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="text-xs text-gray-600">{k.requests} requests</span>
                      </td>
                      <td className="px-5 py-2.5">
                        <span className="text-xs text-red-400/60">
                          revogada {timeAgo(k.revokedAt)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
