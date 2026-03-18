'use client'

import useSWR from 'swr'
import Header from '@/components/layout/Header'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import ExportButton from '@/components/ui/ExportButton'
import LoadingChart from '@/components/ui/LoadingChart'
import KLineChart from '@/components/charts/KLineChart'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function QualityPage() {
  const { data } = useSWR('/api/analytics/quality', fetcher)

  const metrics = data?.metrics ?? {}
  const errorRates = data?.errorRates ?? []
  const leaks = data?.leaks ?? []

  return (
    <>
      <Header title="Qualidade do Modelo" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Error rate hoje"
            value={`${metrics.errorRateToday ?? '—'}%`}
            accent={metrics.errorRateToday > 5}
          />
          <StatCard label="Error rate 7d" value={`${metrics.errorRateLast7d ?? '—'}%`} />
          <StatCard
            label="Thinking leaks 7d"
            value={metrics.thinkingLeaksLast7d ?? '—'}
            sub="respostas com <think>"
            accent={metrics.thinkingLeaksLast7d > 0}
          />
          <StatCard label="Tempo médio" value={metrics.avgResponseTimeMs ? `${metrics.avgResponseTimeMs}ms` : '—'} />
        </div>

        <SectionCard
          title="Error rate por dia"
          subtitle="% das respostas com erro nos últimos 14 dias"
          action={<ExportButton data={errorRates} filename="error-rates" />}
        >
          {!data ? <LoadingChart /> : (
            <KLineChart
              data={errorRates}
              xKey="date"
              series={[{ key: 'errorRate', label: 'Error rate %', color: '#ef4444' }]}
              yFormatter={(v) => `${v}%`}
            />
          )}
        </SectionCard>

        {leaks.length > 0 && (
          <SectionCard title="Thinking leaks — amostras recentes" subtitle="Respostas com <think> visível">
            <div className="space-y-3">
              {leaks.map((l: { text: string; date: Date }, i: number) => (
                <div key={i} className="bg-surface-700/50 rounded-xl p-3 border border-yellow-500/20">
                  <p className="text-xs text-yellow-400 mb-1">{new Date(l.date).toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-gray-300 font-mono break-all">{l.text}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        <SectionCard
          title="Volume de respostas por dia"
          subtitle="Total vs com erro"
          action={<ExportButton data={errorRates} filename="response-volume" />}
        >
          {!data ? <LoadingChart /> : (
            <KLineChart
              data={errorRates}
              xKey="date"
              series={[
                { key: 'total', label: 'Total', color: '#7c3aed' },
                { key: 'errors', label: 'Erros', color: '#ef4444' },
              ]}
            />
          )}
        </SectionCard>
      </div>
    </>
  )
}
