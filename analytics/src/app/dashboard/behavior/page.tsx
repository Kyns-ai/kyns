'use client'

import useSWR from 'swr'
import { useFilters } from '@/components/FilterContext'
import Header from '@/components/layout/Header'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import ExportButton from '@/components/ui/ExportButton'
import LoadingChart from '@/components/ui/LoadingChart'
import KBarChart from '@/components/charts/KBarChart'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function BehaviorPage() {
  const { days } = useFilters()
  const { data } = useSWR(`/api/analytics/behavior?days=${days}`, fetcher)

  const words = data?.words ?? []
  const lengths = data?.lengths ?? []
  const convoStats = data?.convoStats ?? {}
  const signupHours = data?.signupHours ?? []

  return (
    <>
      <Header title="Comportamento" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Engajamento profundo" value={`${convoStats.deepEngagementRate ?? '—'}%`} sub="> 10 turnos" accent />
          <StatCard label="Média de turnos" value={convoStats.avgTurnsPerConvo ?? '—'} sub="por conversa" />
          <StatCard label="Taxa de abandono" value={`${convoStats.abandonmentRate ?? '—'}%`} sub="1 msg e sumiu" />
          <StatCard label="—" value="—" />
        </div>

        {/* Top words */}
        <SectionCard
          title="Palavras mais usadas nas primeiras mensagens"
          subtitle="Top 30 dias — proxy do que os usuários querem"
          action={<ExportButton data={words.slice(0, 50)} filename="first-words" />}
        >
          {!data ? <LoadingChart height={200} /> : (
            <div className="flex flex-wrap gap-2">
              {words.slice(0, 60).map((w: { word: string; count: number }, i: number) => {
                const maxCount = words[0]?.count ?? 1
                const size = 12 + Math.round((w.count / maxCount) * 14)
                const opacity = 0.4 + (w.count / maxCount) * 0.6
                return (
                  <span
                    key={i}
                    className="bg-accent/10 border border-accent/20 rounded-lg px-2 py-1 text-accent-light cursor-default"
                    style={{ fontSize: size, opacity }}
                    title={`${w.word}: ${w.count} vezes`}
                  >
                    {w.word}
                  </span>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Message length distribution */}
        <SectionCard
          title="Distribuição do tamanho das mensagens"
          subtitle="Caracteres por mensagem do usuário"
          action={<ExportButton data={lengths} filename="msg-lengths" />}
        >
          {!data ? <LoadingChart height={220} /> : (
            <KBarChart
              data={lengths}
              xKey="bucket"
              barKey="count"
              label="Mensagens"
              color="#6366f1"
              height={220}
            />
          )}
        </SectionCard>

        {/* First signup by hour */}
        <SectionCard
          title="Horário de cadastro de novos usuários"
          subtitle="Melhor hora para postar no Instagram"
          action={<ExportButton data={signupHours} filename="signup-hours" />}
        >
          {!data ? <LoadingChart height={220} /> : (
            <KBarChart
              data={signupHours}
              xKey="hour"
              barKey="count"
              label="Cadastros"
              color="#10b981"
              height={220}
            />
          )}
        </SectionCard>
      </div>
    </>
  )
}
