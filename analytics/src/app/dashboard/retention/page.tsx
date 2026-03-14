'use client'

import useSWR from 'swr'
import { useFilters } from '@/components/FilterContext'
import Header from '@/components/layout/Header'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import ExportButton from '@/components/ui/ExportButton'
import LoadingChart from '@/components/ui/LoadingChart'
import KLineChart from '@/components/charts/KLineChart'
import KCohortTable from '@/components/charts/KCohortTable'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function RetentionPage() {
  const { days } = useFilters()
  const { data } = useSWR(`/api/analytics/retention?days=${days}`, fetcher)

  const dau = data?.dau ?? []
  const wau = data?.wau ?? []
  const mau = data?.mau ?? []
  const rates = data?.rates ?? {}
  const cohort = data?.cohort ?? []
  const engagement = data?.engagement ?? {}
  const streaks = data?.streaks ?? {}

  const currentDAU = dau[dau.length - 1]?.dau ?? 0
  const currentMAU = mau[mau.length - 1]?.mau ?? 0
  const dauMauRatio = currentMAU > 0 ? Math.round((currentDAU / currentMAU) * 100) : 0

  // Merge DAU into MAU chart (normalize for ratio)
  const dauMauData = dau.slice(-30).map((d: { date: string; dau: number }) => ({
    date: d.date,
    dau: d.dau,
  }))

  return (
    <>
      <Header title="Retenção" />
      <div className="p-6 space-y-6">
        {/* Retention rates */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="D1 Retenção" value={`${rates.d1 ?? '—'}%`} sub={`coorte de ${rates.totalCohort ?? 0} usuários`} accent />
          <StatCard label="D7 Retenção" value={`${rates.d7 ?? '—'}%`} />
          <StatCard label="D30 Retenção" value={`${rates.d30 ?? '—'}%`} />
          <StatCard label="DAU/MAU ratio" value={`${dauMauRatio}%`} sub="engagement rate" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Msgs/user/dia" value={engagement.avgMessagesPerUserPerDay ?? '—'} />
          <StatCard label="Users no limite" value={engagement.usersAtDailyLimit ?? '—'} sub={`${engagement.usersAtDailyLimitPct ?? 0}% do total`} />
          <StatCard label="DAU atual" value={currentDAU.toLocaleString('pt-BR')} />
          <StatCard label="MAU atual" value={currentMAU.toLocaleString('pt-BR')} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Streak 3+ dias" value={streaks.streak3plus ?? '—'} sub="usuários ativos" accent />
          <StatCard label="Streak 7+ dias" value={streaks.streak7plus ?? '—'} sub="usuários ativos" />
          <StatCard label="Maior streak atual" value={`${streaks.longestCurrent ?? '—'} dias`} />
          <StatCard label="Streak médio" value={`${streaks.avgStreakLength ?? '—'} dias`} sub="todos os usuários" />
        </div>

        {/* DAU chart */}
        <SectionCard
          title="DAU — Usuários Ativos Diários"
          subtitle={`Últimos ${days} dias`}
          action={<ExportButton data={dau} filename="dau" />}
        >
          {!data ? <LoadingChart /> : (
            <KLineChart
              data={dauMauData}
              xKey="date"
              series={[{ key: 'dau', label: 'DAU', color: '#7c3aed' }]}
            />
          )}
        </SectionCard>

        {/* WAU + MAU */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard title="WAU — Semanal" action={<ExportButton data={wau} filename="wau" />}>
            {!data ? <LoadingChart height={200} /> : (
              <KLineChart
                data={wau}
                xKey="week"
                series={[{ key: 'wau', label: 'WAU', color: '#10b981' }]}
                height={200}
              />
            )}
          </SectionCard>
          <SectionCard title="MAU — Mensal" action={<ExportButton data={mau} filename="mau" />}>
            {!data ? <LoadingChart height={200} /> : (
              <KLineChart
                data={mau}
                xKey="month"
                series={[{ key: 'mau', label: 'MAU', color: '#f59e0b' }]}
                height={200}
              />
            )}
          </SectionCard>
        </div>

        {/* Cohort table */}
        <SectionCard
          title="Cohort Analysis — Retenção semanal"
          subtitle="% de usuários ativos por semana após o cadastro"
          action={<ExportButton data={cohort} filename="cohort" />}
        >
          {!data ? <LoadingChart height={200} /> : <KCohortTable data={cohort} />}
        </SectionCard>
      </div>
    </>
  )
}
