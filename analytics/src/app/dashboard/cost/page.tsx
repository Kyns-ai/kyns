'use client'

import useSWR from 'swr'
import { useFilters } from '@/components/FilterContext'
import Header from '@/components/layout/Header'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import ExportButton from '@/components/ui/ExportButton'
import LoadingChart from '@/components/ui/LoadingChart'
import KLineChart from '@/components/charts/KLineChart'
import KBarChart from '@/components/charts/KBarChart'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function formatUSD(v: number) {
  if (v < 0.01) return `$${(v * 1000).toFixed(2)}m`
  return `$${v.toFixed(v >= 100 ? 0 : v >= 1 ? 2 : 4)}`
}

function formatTokens(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
  return String(v)
}

export default function CostPage() {
  const { days } = useFilters()
  const { data } = useSWR(`/api/analytics/cost?days=${days}`, fetcher)

  const daily = data?.daily ?? []
  const summary = data?.summary ?? {}
  const byEndpoint = data?.byEndpoint ?? []

  return (
    <>
      <Header title="Custo" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={`Custo total (${days}d)`} value={formatUSD(summary.totalCostUSD ?? 0)} accent />
          <StatCard label="Projeção mensal" value={formatUSD(summary.projectedMonthlyUSD ?? 0)} />
          <StatCard label="Custo/usuário ativo" value={formatUSD(summary.costPerActiveUser ?? 0)} sub="por dia" />
          <StatCard label="Custo/mensagem" value={formatUSD(summary.costPerMessage ?? 0)} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Input tokens" value={formatTokens(summary.totalInputTokens ?? 0)} />
          <StatCard label="Output tokens" value={formatTokens(summary.totalOutputTokens ?? 0)} />
          <StatCard label="DAU médio" value={summary.avgDailyActiveUsers ?? '—'} />
          <StatCard label="Msgs/dia" value={(summary.avgDailyMessages ?? 0).toLocaleString('pt-BR')} />
        </div>

        <SectionCard
          title="Custo por dia"
          subtitle="USD"
          action={<ExportButton data={daily} filename="cost-per-day" />}
        >
          {!data ? <LoadingChart /> : (
            <KLineChart
              data={daily}
              xKey="date"
              series={[{ key: 'costUSD', label: 'Custo (USD)', color: '#f59e0b' }]}
              yFormatter={formatUSD}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Tokens por dia"
          subtitle="Input vs Output"
          action={<ExportButton data={daily} filename="tokens-per-day" />}
        >
          {!data ? <LoadingChart /> : (
            <KLineChart
              data={daily}
              xKey="date"
              series={[
                { key: 'inputTokens', label: 'Input', color: '#7c3aed' },
                { key: 'outputTokens', label: 'Output', color: '#10b981' },
              ]}
              yFormatter={formatTokens}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Custo por modelo"
          subtitle="Breakdown de custo nos últimos 30 dias"
          action={<ExportButton data={byEndpoint} filename="cost-by-endpoint" />}
        >
          {!data ? <LoadingChart height={220} /> : (
            <KBarChart
              data={byEndpoint.slice(0, 8).map((e: { endpoint: string; costUSD: number }) => ({
                name: e.endpoint.length > 25 ? e.endpoint.substring(0, 25) + '…' : e.endpoint,
                Custo: e.costUSD,
              }))}
              xKey="name"
              barKey="Custo"
              horizontal
              height={220}
              color="#f59e0b"
              label="USD"
            />
          )}
        </SectionCard>
      </div>
    </>
  )
}
