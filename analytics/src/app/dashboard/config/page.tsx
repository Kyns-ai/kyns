'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import Toggle from '@/components/ui/Toggle'
import type { PlatformConfig } from '@/lib/queries/admin-config'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ConfigPage() {
  const { data, mutate } = useSWR<PlatformConfig>('/api/admin/config', fetcher)
  const [form, setForm] = useState<PlatformConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (data && !form) setForm(JSON.parse(JSON.stringify(data)) as PlatformConfig)
  }, [data, form])

  const save = async (partial: Partial<PlatformConfig>) => {
    setSaving(true)
    try {
      await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      })
      mutate()
      setToast('Configuração salva!')
      setTimeout(() => setToast(''), 2500)
    } finally {
      setSaving(false)
    }
  }

  const update = <K extends keyof PlatformConfig>(key: K, value: PlatformConfig[K]) => {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  if (!form) {
    return (
      <>
        <Header title="Configuração da Plataforma" />
        <div className="p-6">
          <div className="h-64 bg-white/5 rounded-xl animate-pulse" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Configuração da Plataforma" />
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Quick toggles */}
        <SectionCard title="Toggles Globais" subtitle="Mudanças imediatas na plataforma">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'maintenanceMode' as const, label: 'Modo Manutenção', desc: 'Bloqueia acesso de não-admins' },
              { key: 'openRegistration' as const, label: 'Registro Aberto', desc: 'Permite novos cadastros' },
              { key: 'nsfwEnabled' as const, label: 'NSFW Habilitado', desc: 'Permite conteúdo adulto' },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-start justify-between p-4 bg-white/3 rounded-lg border border-white/5">
                <div>
                  <p className="text-sm font-medium text-white">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <Toggle
                  checked={form[key] as boolean}
                  onChange={(v) => { update(key, v as PlatformConfig[typeof key]); save({ [key]: v }) }}
                />
              </div>
            ))}
          </div>
          {form.maintenanceMode && (
            <div className="mt-3">
              <label className="block text-xs text-gray-400 mb-1">Mensagem de Manutenção</label>
              <div className="flex gap-2">
                <input
                  value={form.maintenanceMessage}
                  onChange={(e) => update('maintenanceMessage', e.target.value)}
                  className="flex-1 bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <button
                  disabled={saving}
                  onClick={() => save({ maintenanceMessage: form.maintenanceMessage })}
                  className="px-3 py-2 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg disabled:opacity-50"
                >Salvar</button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Free limits */}
        <SectionCard title="Limites do Plano Free" subtitle="Máximo por dia para usuários free">
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: 'messagesPerDay' as const, label: 'Mensagens/dia' },
              { key: 'imagesPerDay' as const, label: 'Imagens/dia' },
              { key: 'deepPerDay' as const, label: 'Deep mode/dia' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-gray-400 mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  value={form.freeLimits[key]}
                  onChange={(e) => update('freeLimits', { ...form.freeLimits, [key]: Number(e.target.value) })}
                  className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            ))}
          </div>
          <button
            disabled={saving}
            onClick={() => save({ freeLimits: form.freeLimits })}
            className="mt-3 px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg disabled:opacity-50"
          >{saving ? 'Salvando…' : 'Salvar limites'}</button>
        </SectionCard>

        {/* Welcome message */}
        <SectionCard title="Mensagem de Boas-vindas" subtitle="Exibida para novos usuários">
          <textarea
            value={form.welcomeMessage}
            onChange={(e) => update('welcomeMessage', e.target.value)}
            rows={4}
            className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
          <button
            disabled={saving}
            onClick={() => save({ welcomeMessage: form.welcomeMessage })}
            className="mt-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg disabled:opacity-50"
          >Salvar</button>
        </SectionCard>

        {/* Terms & Privacy */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { key: 'termsOfUse' as const, title: 'Termos de Uso' },
            { key: 'privacyPolicy' as const, title: 'Política de Privacidade' },
          ].map(({ key, title }) => (
            <SectionCard key={key} title={title} subtitle="">
              <textarea
                value={form[key] as string}
                onChange={(e) => update(key, e.target.value as PlatformConfig[typeof key])}
                rows={8}
                className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                placeholder={`Insira o texto de ${title.toLowerCase()}…`}
              />
              <button
                disabled={saving}
                onClick={() => save({ [key]: form[key] })}
                className="mt-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg disabled:opacity-50"
              >Salvar</button>
            </SectionCard>
          ))}
        </div>

        {/* Watermark */}
        <SectionCard title="Watermark de Imagem" subtitle="Marca d'água em imagens geradas">
          <div className="space-y-3">
            <Toggle
              checked={form.watermark.enabled}
              onChange={(v) => update('watermark', { ...form.watermark, enabled: v })}
              label="Habilitar watermark"
            />
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Texto</label>
                <input
                  value={form.watermark.text}
                  onChange={(e) => update('watermark', { ...form.watermark, text: e.target.value })}
                  className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Posição</label>
                <select
                  value={form.watermark.position}
                  onChange={(e) => update('watermark', { ...form.watermark, position: e.target.value })}
                  className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                >
                  {['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Opacidade (0–1)</label>
                <input
                  type="number" min={0} max={1} step={0.1}
                  value={form.watermark.opacity}
                  onChange={(e) => update('watermark', { ...form.watermark, opacity: Number(e.target.value) })}
                  className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
            <button
              disabled={saving}
              onClick={() => save({ watermark: form.watermark })}
              className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg disabled:opacity-50"
            >Salvar watermark</button>
          </div>
        </SectionCard>
      </div>
    </>
  )
}
