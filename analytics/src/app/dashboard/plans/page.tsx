'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import StatCard from '@/components/ui/StatCard'
import type { PlatformConfig } from '@/lib/queries/admin-config'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface Plan {
  id: string
  name: string
  price: number
  currency: string
  limits: { messagesPerDay: number; imagesPerDay: number; deepPerDay: number }
  color: string
}

const DEFAULT_PLANS: Plan[] = [
  { id: 'free', name: 'Free', price: 0, currency: 'BRL', limits: { messagesPerDay: 30, imagesPerDay: 5, deepPerDay: 3 }, color: 'gray' },
  { id: 'pro', name: 'Pro', price: 29.90, currency: 'BRL', limits: { messagesPerDay: 300, imagesPerDay: 50, deepPerDay: 30 }, color: 'accent' },
  { id: 'business', name: 'Business', price: 99.90, currency: 'BRL', limits: { messagesPerDay: 9999, imagesPerDay: 500, deepPerDay: 300 }, color: 'yellow' },
]

export default function PlansPage() {
  const { data: config } = useSWR<PlatformConfig>('/api/admin/config', fetcher)
  const { data: rt } = useSWR('/api/analytics/realtime', fetcher)
  const [plans] = useState<Plan[]>(DEFAULT_PLANS)
  const [saving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 2500)
      return () => clearTimeout(t)
    }
  }, [toast])

  const proUsers = Math.round((rt?.totalUsers ?? 0) * 0.03)
  const estimatedRevenue = proUsers * 29.90

  return (
    <>
      <Header title="Planos e Monetização" />
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>
      )}

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total de usuários" value={rt?.totalUsers ?? '—'} />
          <StatCard label="Estimativa Pro (3%)" value={proUsers} sub="estimativa" />
          <StatCard label="Receita estimada/mês" value={`R$ ${estimatedRevenue.toFixed(2)}`} sub="baseado em 3% Pro" accent />
          <StatCard label="Limite free/dia" value={config?.freeLimits.messagesPerDay ?? '—'} sub="msgs por dia" />
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <SectionCard key={plan.id} title={plan.name} subtitle={plan.price === 0 ? 'Gratuito' : `R$ ${plan.price.toFixed(2)}/mês`}>
              <div className="space-y-3">
                {[
                  { key: 'messagesPerDay', label: 'Mensagens/dia' },
                  { key: 'imagesPerDay', label: 'Imagens/dia' },
                  { key: 'deepPerDay', label: 'Deep mode/dia' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{label}</span>
                    <span className="text-sm font-medium text-white">
                      {plan.limits[key as keyof typeof plan.limits] >= 9999 ? '∞' : plan.limits[key as keyof typeof plan.limits]}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>

        {/* Stripe placeholder */}
        <SectionCard title="Integração Stripe" subtitle="Configure pagamentos para monetização">
          <div className="flex items-center justify-between p-4 bg-white/3 rounded-lg border border-white/10 border-dashed">
            <div>
              <p className="text-sm font-medium text-white">Stripe não configurado</p>
              <p className="text-xs text-gray-500 mt-1">Conecte o Stripe para aceitar pagamentos e gerenciar assinaturas Pro</p>
            </div>
            <button
              disabled
              className="px-4 py-2 bg-white/5 text-gray-400 text-sm rounded-lg cursor-not-allowed"
            >
              Conectar Stripe (em breve)
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {[
              ['STRIPE_SECRET_KEY', 'Chave secreta do Stripe'],
              ['STRIPE_WEBHOOK_SECRET', 'Secret para validar webhooks'],
              ['STRIPE_PRO_PRICE_ID', 'ID do preço do plano Pro'],
            ].map(([varName, desc]) => (
              <div key={varName} className="flex items-center gap-3 p-2 bg-white/3 rounded font-mono text-xs">
                <code className="text-gray-500">{varName}</code>
                <span className="text-gray-600">{desc}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Churn placeholder */}
        <SectionCard title="Churn de Assinantes" subtitle="Disponível após integração Stripe">
          <div className="text-center py-8 text-gray-600">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm">Dados de churn disponíveis após integrar o Stripe</p>
          </div>
        </SectionCard>
      </div>
    </>
  )
}
