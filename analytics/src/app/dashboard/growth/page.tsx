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

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function GrowthPage() {
  const { days } = useFilters()
  const { data } = useSWR(`/api/analytics/growth?days=${days}`, fetcher)

  const signupsDay = data?.signupsDay ?? []
  const signupsHour = data?.signupsHour ?? []
  const churn = data?.churn ?? []
  const providers = data?.providers ?? []

  const lastChurn = churn[churn.length - 1]
  const totalSignups = signupsDay.reduce((s: number, d: { count: number }) => s + d.count, 0)

  return (
    <>
      <Header title="Crescimento" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={`Novos usuários (${days}d)`} value={totalSignups.toLocaleString('pt-BR')} accent />
          <StatCard label="Churn semanal" value={lastChurn ? `${lastChurn.churnRate}%` : '—'} sub="última semana" />
          <StatCard label="Net growth" value={lastChurn ? lastChurn.netGrowth.toLocaleString('pt-BR') : '—'} sub="última semana" />
          <StatCard label="Churned" value={lastChurn ? lastChurn.churnedUsers.toLocaleString('pt-BR') : '—'} />
        </div>

        <SectionCard
          title="Signups por dia"
          subtitle={`Últimos ${days} dias`}
          action={<ExportButton data={signupsDay} filename="signups-day" />}
        >
          {!data ? <LoadingChart /> : (
            <KLineChart
              data={signupsDay}
              xKey="date"
              series={[
                { key: 'count', label: 'Novos usuários', color: '#10b981' },
                { key: 'cumulative', label: 'Acumulado', color: '#7c3aed' },
              ]}
            />
          )}
        </SectionCard>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard
            title="Signups por hora do dia"
            subtitle="Melhor horário para posts no Instagram"
            action={<ExportButton data={signupsHour} filename="signups-hour" />}
          >
            {!data ? <LoadingChart height={220} /> : (
              <KBarChart
                data={signupsHour}
                xKey="hour"
                barKey="count"
                label="Signups"
                color="#10b981"
                height={220}
              />
            )}
          </SectionCard>

          <SectionCard title="Canal de cadastro" subtitle="De onde vêm os usuários">
            {!data ? <LoadingChart height={220} /> : (
              <KPieChart
                data={providers.map((p: { provider: string; count: number }) => ({
                  name: p.provider,
                  value: p.count,
                }))}
                height={220}
              />
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Net Growth semanal"
          subtitle="Novos usuários − churned"
          action={<ExportButton data={churn} filename="weekly-churn" />}
        >
          {!data ? <LoadingChart /> : (
            <KBarChart
              data={churn}
              xKey="week"
              barKey="newUsers"
              secondaryKey="churnedUsers"
              label="Novos"
              secondaryLabel="Churned"
              color="#10b981"
              secondaryColor="#ef4444"
            />
          )}
        </SectionCard>
      </div>
    </>
  )
}
