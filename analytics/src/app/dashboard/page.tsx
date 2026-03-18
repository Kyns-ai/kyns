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
import KPieChart from '@/components/charts/KPieChart'
import KHeatmap from '@/components/charts/KHeatmap'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function OverviewPage() {
  const { days } = useFilters()

  const { data: rt } = useSWR('/api/analytics/realtime', fetcher, { refreshInterval: 30_000 })
  const { data: usage } = useSWR(`/api/analytics/usage?days=${days}`, fetcher)

  const endpointData =
    usage?.endpoints?.map((e: { endpoint: string; count: number }) => ({
      name: endpointLabel(e.endpoint),
      value: e.count,
    })) ?? []

  return (
    <>
      <Header title="Visão Geral" />
      <div className="p-6 space-y-6">
        {/* Real-time cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Online agora"
            value={rt?.usersOnline ?? '—'}
            sub="últimos 5 min"
            accent
            icon={<svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /></svg>}
          />
          <StatCard label="Total de usuários" value={rt?.totalUsers ?? '—'} />
          <StatCard label="Msgs hoje" value={rt?.messagesToday ?? '—'} sub={`${rt?.conversationsToday ?? '—'} conversas`} />
          <StatCard label="Erros hoje" value={rt?.errorsToday ?? '—'} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Msgs 24h" value={rt?.messagesLast24h ?? '—'} />
          <StatCard label={`Msgs ${days}d`} value={rt?.messagesLast30d ?? '—'} />
          <StatCard label="Imagens hoje" value={rt?.imagesGeneratedToday ?? '—'} />
          <StatCard label="Pesquisas web" value={rt?.webSearchesToday ?? '—'} />
        </div>

        {/* Messages per day */}
        <SectionCard
          title="Mensagens por dia"
          subtitle={`Últimos ${days} dias — usuários`}
          action={<ExportButton data={usage?.messagesPerDay ?? []} filename="messages-per-day" />}
        >
          {!usage ? (
            <LoadingChart />
          ) : (
            <KLineChart
              data={usage.messagesPerDay}
              xKey="date"
              series={[{ key: 'count', label: 'Mensagens', color: '#7c3aed' }]}
            />
          )}
        </SectionCard>

        {/* 2-column: endpoint breakdown + agent ranking */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard title="Por modo" subtitle="Distribuição de uso">
            {!usage ? (
              <LoadingChart height={220} />
            ) : (
              <KPieChart data={endpointData} height={220} />
            )}
          </SectionCard>

          <SectionCard
            title="Top Characters"
            subtitle="Por número de mensagens"
            action={<ExportButton data={usage?.agents ?? []} filename="agent-usage" />}
          >
            {!usage ? (
              <LoadingChart height={220} />
            ) : (
              <KBarChart
                data={(usage.agents ?? []).slice(0, 8).map((a: { name: string; messages: number }) => ({
                  name: a.name.length > 20 ? a.name.substring(0, 20) + '…' : a.name,
                  messages: a.messages,
                }))}
                xKey="name"
                barKey="messages"
                horizontal
                height={220}
                color="#7c3aed"
                label="Mensagens"
              />
            )}
          </SectionCard>
        </div>

        {/* Heatmap */}
        <SectionCard title="Heatmap — hora × dia da semana" subtitle={`Últimos ${days} dias`}>
          {!usage ? (
            <LoadingChart height={200} />
          ) : (
            <KHeatmap data={usage.heatmap ?? []} />
          )}
        </SectionCard>

        {/* Tokens per day */}
        <SectionCard
          title="Tokens por dia"
          subtitle="Input vs output"
          action={<ExportButton data={usage?.tokens ?? []} filename="tokens-per-day" />}
        >
          {!usage ? (
            <LoadingChart />
          ) : (
            <KLineChart
              data={usage.tokens}
              xKey="date"
              series={[
                { key: 'inputTokens', label: 'Input', color: '#7c3aed' },
                { key: 'outputTokens', label: 'Output', color: '#10b981' },
              ]}
              yFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
          )}
        </SectionCard>
      </div>
    </>
  )
}

function endpointLabel(ep: string) {
  const map: Record<string, string> = {
    KYNS: 'KYNS Normal',
    KYNSDeep: 'KYNS Deep',
    agents: 'Characters',
    openAI: 'OpenAI',
  }
  return map[ep] ?? ep
}
