'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import Toggle from '@/components/ui/Toggle'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface AlertConfig {
  webhook: string
  email: string
  thresholds: {
    errorRatePercent: number
    dailyCostUsd: number
    notifyOnSignup: boolean
    notifyOnThinkingLeak: boolean
  }
}

export default function AlertsPage() {
  const { data, mutate } = useSWR<AlertConfig>('/api/admin/alerts', fetcher)
  const [form, setForm] = useState<AlertConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [testResult, setTestResult] = useState('')

  useEffect(() => {
    if (data && !form) setForm(JSON.parse(JSON.stringify(data)) as AlertConfig)
  }, [data, form])

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      await fetch('/api/admin/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      mutate()
      setToast('Configuração salva!')
      setTimeout(() => setToast(''), 2500)
    } finally {
      setSaving(false)
    }
  }

  const testWebhook = async () => {
    if (!form?.webhook) return
    setTestResult('Enviando…')
    try {
      const res = await fetch(form.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '✅ KYNS Analytics: Webhook de teste enviado com sucesso!',
          embeds: [{ title: 'Teste de Alerta', description: 'Este é um alerta de teste do KYNS Analytics Dashboard.', color: 0x7c3aed }],
        }),
      })
      setTestResult(res.ok ? '✅ Webhook enviado!' : `❌ Erro: ${res.status}`)
    } catch {
      setTestResult('❌ Falhou (CORS ou URL inválida)')
    }
    setTimeout(() => setTestResult(''), 4000)
  }

  if (!form) {
    return (
      <>
        <Header title="Notificações e Alertas" />
        <div className="p-6"><div className="h-64 bg-white/5 rounded-xl animate-pulse" /></div>
      </>
    )
  }

  return (
    <>
      <Header title="Notificações e Alertas" />
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>
      )}

      <div className="p-6 space-y-6">
        {/* Channels */}
        <SectionCard title="Canais de Notificação" subtitle="Configure onde receber alertas">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Webhook (Slack / Discord / Custom)</label>
              <div className="flex gap-2">
                <input
                  value={form.webhook}
                  onChange={(e) => setForm({ ...form, webhook: e.target.value })}
                  placeholder="https://hooks.slack.com/services/… ou https://discord.com/api/webhooks/…"
                  className="flex-1 bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  onClick={testWebhook}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm rounded-lg"
                >Testar</button>
              </div>
              {testResult && <p className="text-xs mt-1 text-gray-400">{testResult}</p>}
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Email (opcional)</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                type="email"
                placeholder="admin@kyns.ai"
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <p className="text-xs text-gray-600 mt-1">Requer configuração de SMTP na infraestrutura</p>
            </div>
          </div>
        </SectionCard>

        {/* Thresholds */}
        <SectionCard title="Thresholds de Alerta" subtitle="Quando disparar notificações">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Error rate (%) — alerta quando acima</label>
                <input
                  type="number" min={0} max={100} step={0.5}
                  value={form.thresholds.errorRatePercent}
                  onChange={(e) => setForm({ ...form, thresholds: { ...form.thresholds, errorRatePercent: Number(e.target.value) } })}
                  className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Custo diário (USD) — alerta quando acima</label>
                <input
                  type="number" min={0} step={0.5}
                  value={form.thresholds.dailyCostUsd}
                  onChange={(e) => setForm({ ...form, thresholds: { ...form.thresholds, dailyCostUsd: Number(e.target.value) } })}
                  className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            <div className="space-y-3">
              {[
                { key: 'notifyOnSignup' as const, label: 'Novo signup', desc: 'Notificar a cada novo cadastro' },
                { key: 'notifyOnThinkingLeak' as const, label: 'Thinking Leak detectado', desc: 'Notificar quando detectar <think> nas respostas' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-white/3 rounded-lg">
                  <div>
                    <p className="text-sm text-white">{label}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                  <Toggle
                    checked={form.thresholds[key]}
                    onChange={(v) => setForm({ ...form, thresholds: { ...form.thresholds, [key]: v } })}
                  />
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Alert types info */}
        <SectionCard title="Tipos de Alerta Configurados" subtitle="Todos os eventos monitorados">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { icon: '🔴', event: 'Endpoint caiu', trigger: 'Sempre que um endpoint vai offline' },
              { icon: '📊', event: `Error rate > ${form.thresholds.errorRatePercent}%`, trigger: 'Verificado a cada 5 min' },
              { icon: '💰', event: `Custo > $${form.thresholds.dailyCostUsd}/dia`, trigger: 'Verificado às 23:59 UTC' },
              { icon: '🧠', event: 'Thinking leak', trigger: form.thresholds.notifyOnThinkingLeak ? 'Ativo' : 'Desativado' },
              { icon: '👤', event: 'Novo signup', trigger: form.thresholds.notifyOnSignup ? 'Ativo' : 'Desativado' },
              { icon: '🔁', event: 'Looping detectado', trigger: 'Sempre que detectado' },
            ].map(({ icon, event, trigger }) => (
              <div key={event} className="flex items-start gap-3 p-3 bg-white/3 rounded-lg">
                <span className="text-lg">{icon}</span>
                <div>
                  <p className="text-sm text-white">{event}</p>
                  <p className="text-xs text-gray-500">{trigger}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="flex justify-end">
          <button
            disabled={saving}
            onClick={save}
            className="px-6 py-2.5 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg disabled:opacity-50"
          >{saving ? 'Salvando…' : 'Salvar configurações'}</button>
        </div>
      </div>
    </>
  )
}
