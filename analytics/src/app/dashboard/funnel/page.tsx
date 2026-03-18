'use client'

import useSWR from 'swr'
import { useFilters } from '@/components/FilterContext'
import Header from '@/components/layout/Header'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import ExportButton from '@/components/ui/ExportButton'
import LoadingChart from '@/components/ui/LoadingChart'
import KFunnelChart from '@/components/charts/KFunnelChart'
import KBarChart from '@/components/charts/KBarChart'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function FunnelPage() {
  const { days } = useFilters()
  const { data } = useSWR(`/api/analytics/funnel?days=${days}`, fetcher)

  const funnel = data?.funnel ?? []
  const timeToFirst = data?.timeToFirst ?? []
  const activation = data?.activation ?? {}

  return (
    <>
      <Header title="Funil de Conversão" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Signups" value={(activation.signups ?? 0).toLocaleString('pt-BR')} />
          <StatCard label="Taxa de ativação" value={`${activation.rate ?? '—'}%`} sub="enviaram ≥ 1 msg" accent />
          <StatCard label="Ativados" value={(activation.activated ?? 0).toLocaleString('pt-BR')} />
        </div>

        <SectionCard
          title="Funil de ativação"
          subtitle={`Últimos ${days} dias`}
          action={<ExportButton data={funnel} filename="funnel" />}
        >
          {!data ? <LoadingChart height={280} /> : <KFunnelChart data={funnel} />}
        </SectionCard>

        <SectionCard
          title="Tempo até a primeira mensagem"
          subtitle="Quanto tempo após o cadastro o usuário envia a primeira mensagem"
          action={<ExportButton data={timeToFirst} filename="time-to-first" />}
        >
          {!data ? <LoadingChart height={220} /> : (
            <KBarChart
              data={timeToFirst}
              xKey="bucket"
              barKey="count"
              label="Usuários"
              color="#7c3aed"
              height={220}
            />
          )}
        </SectionCard>
      </div>
    </>
  )
}
