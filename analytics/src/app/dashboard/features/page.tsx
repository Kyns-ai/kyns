'use client'

import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import ExportButton from '@/components/ui/ExportButton'
import LoadingChart from '@/components/ui/LoadingChart'
import KBarChart from '@/components/charts/KBarChart'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function FeaturesPage() {
  const { data } = useSWR('/api/analytics/features', fetcher)
  const features = data?.features ?? []
  const correlation = data?.correlation ?? []

  return (
    <>
      <Header title="Features" />
      <div className="p-6 space-y-6">
        {/* Feature usage table */}
        <SectionCard
          title="Uso de Features — últimos 7 dias"
          subtitle="% dos usuários ativos que usaram cada feature"
          action={<ExportButton data={features} filename="features" />}
        >
          {!data ? <LoadingChart height={220} /> : (
            <div className="space-y-3">
              {features.map((f: { feature: string; label: string; pctLast7d: number; usersLast7d: number; totalUsages7d: number; pctLast30d: number; usersLast30d: number }) => (
                <div key={f.feature} className="flex items-center gap-3">
                  <span className="text-sm text-gray-300 w-40 shrink-0">{f.label}</span>
                  <div className="flex-1 bg-surface-700/50 rounded-full h-5 relative overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent/70 transition-all"
                      style={{ width: `${f.pctLast7d}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                      {f.pctLast7d}% ({f.usersLast7d} users)
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 w-28 text-right">{f.totalUsages7d.toLocaleString('pt-BR')} usos</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* 7d vs 30d comparison */}
        <SectionCard
          title="Features: 7d vs 30d"
          subtitle="Comparativo de adoção"
          action={<ExportButton data={features} filename="features-comparison" />}
        >
          {!data ? <LoadingChart height={250} /> : (
            <KBarChart
              data={features.map((f: { label: string; pctLast7d: number; pctLast30d: number }) => ({
                name: f.label,
                '7 dias': f.pctLast7d,
                '30 dias': f.pctLast30d,
              }))}
              xKey="name"
              barKey="7 dias"
              secondaryKey="30 dias"
              label="7 dias"
              secondaryLabel="30 dias"
              color="#7c3aed"
              secondaryColor="#10b981"
              height={250}
            />
          )}
        </SectionCard>

        {/* Feature → retention correlation */}
        <SectionCard
          title="Feature × Retenção"
          subtitle="% de usuários retidos (voltaram na semana seguinte) vs churned que usaram cada feature"
          action={<ExportButton data={correlation} filename="feature-retention" />}
        >
          {!data ? <LoadingChart height={220} /> : (
            correlation.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Dados insuficientes (precisa de 2 semanas de histórico)</p>
            ) : (
              <div className="space-y-3">
                {correlation.map((c: { feature: string; label: string; retainedUsersPct: number; churnedUsersPct: number }) => (
                  <div key={c.feature}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300">{c.label}</span>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="text-emerald-400">Retidos: {c.retainedUsersPct}%</span>
                        <span className="text-red-400">Churned: {c.churnedUsersPct}%</span>
                        <span className={`font-semibold ${c.retainedUsersPct > c.churnedUsersPct ? 'text-emerald-400' : 'text-gray-400'}`}>
                          Δ +{c.retainedUsersPct - c.churnedUsersPct}pp
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <div
                        className="h-2 rounded-full bg-emerald-500/60 transition-all"
                        style={{ width: `${c.retainedUsersPct}%` }}
                      />
                    </div>
                    <div className="flex gap-1 mt-0.5">
                      <div
                        className="h-2 rounded-full bg-red-500/40 transition-all"
                        style={{ width: `${c.churnedUsersPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </SectionCard>
      </div>
    </>
  )
}
