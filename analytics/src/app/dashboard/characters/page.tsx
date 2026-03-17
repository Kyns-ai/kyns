'use client'

import useSWR from 'swr'
import { useFilters } from '@/components/FilterContext'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import StatCard from '@/components/ui/StatCard'
import ExportButton from '@/components/ui/ExportButton'
import LoadingChart from '@/components/ui/LoadingChart'
import KBarChart from '@/components/charts/KBarChart'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function CharactersPage() {
  const { days } = useFilters()
  const { data } = useSWR(`/api/analytics/characters?days=${days}`, fetcher)

  const stats = data?.stats ?? []
  const retention = data?.retention ?? []
  const deepEngagement = data?.deepEngagement ?? { platformDeepPct: 0, characters: [] }

  return (
    <>
      <Header title="Characters" />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total de Characters" value={stats.length} />
          <StatCard
            label="Mais popular"
            value={stats[0]?.name ?? '—'}
            sub={`${(stats[0]?.totalMessages ?? 0).toLocaleString('pt-BR')} msgs`}
          />
          <StatCard
            label="Mais engajante"
            value={stats.sort((a: { avgConversationTurns: number }, b: { avgConversationTurns: number }) => b.avgConversationTurns - a.avgConversationTurns)[0]?.name ?? '—'}
            sub="maior média de turnos"
          />
          <StatCard
            label="Conversas profundas"
            value={`${deepEngagement.platformDeepPct}%`}
            sub=">20 msgs do usuário"
            accent
          />
        </div>

        {/* Ranking by messages */}
        <SectionCard
          title="Ranking por mensagens"
          action={<ExportButton data={stats} filename="characters" />}
        >
          {!data ? <LoadingChart height={280} /> : (
            <KBarChart
              data={stats.slice(0, 12).map((c: { name: string; totalMessages: number; uniqueUsers: number }) => ({
                name: c.name.length > 25 ? c.name.substring(0, 25) + '…' : c.name,
                Mensagens: c.totalMessages,
                'Users únicos': c.uniqueUsers,
              }))}
              xKey="name"
              barKey="Mensagens"
              secondaryKey="Users únicos"
              label="Mensagens"
              secondaryLabel="Users únicos"
              horizontal
              height={280}
            />
          )}
        </SectionCard>

        {/* Avg turns + abandonment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard title="Média de turnos por conversa" subtitle="Mais turnos = mais engajamento">
            {!data ? <LoadingChart height={220} /> : (
              <KBarChart
                data={stats.slice(0, 8).map((c: { name: string; avgConversationTurns: number }) => ({
                  name: c.name.length > 20 ? c.name.substring(0, 20) + '…' : c.name,
                  Turnos: c.avgConversationTurns,
                }))}
                xKey="name"
                barKey="Turnos"
                horizontal
                height={220}
                color="#10b981"
              />
            )}
          </SectionCard>

          <SectionCard title="Taxa de abandono" subtitle="% conversas com < 3 msgs (expectativa não atendida)">
            {!data ? <LoadingChart height={220} /> : (
              <KBarChart
                data={stats.slice(0, 8).map((c: { name: string; abandonmentRate: number }) => ({
                  name: c.name.length > 20 ? c.name.substring(0, 20) + '…' : c.name,
                  Abandono: c.abandonmentRate,
                }))}
                xKey="name"
                barKey="Abandono"
                horizontal
                height={220}
                color="#ef4444"
              />
            )}
          </SectionCard>
        </div>

        {/* Deep engagement per character */}
        <SectionCard
          title="Conversas profundas por Character"
          subtitle="% de conversas com >20 mensagens do usuário"
        >
          {!data ? <LoadingChart height={250} /> : (
            deepEngagement.characters.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Dados insuficientes</p>
            ) : (
              <KBarChart
                data={deepEngagement.characters.slice(0, 10).map((c: { name: string; deepPct: number }) => ({
                  name: c.name.length > 25 ? c.name.substring(0, 25) + '…' : c.name,
                  '% Profundas': c.deepPct,
                }))}
                xKey="name"
                barKey="% Profundas"
                horizontal
                height={250}
                color="#f59e0b"
              />
            )
          )}
        </SectionCard>

        {/* Character retention correlation */}
        <SectionCard
          title="Characters × Retenção D7"
          subtitle="Proxy: % de usuários que voltaram na semana seguinte após usar o character"
          action={<ExportButton data={retention} filename="character-retention" />}
        >
          {!data ? <LoadingChart height={250} /> : (
            retention.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Dados insuficientes</p>
            ) : (
              <KBarChart
                data={retention.slice(0, 10).map((c: { name: string; d7RetentionProxy: number }) => ({
                  name: c.name.length > 25 ? c.name.substring(0, 25) + '…' : c.name,
                  'D7 Retenção': c.d7RetentionProxy,
                }))}
                xKey="name"
                barKey="D7 Retenção"
                horizontal
                height={250}
                color="#7c3aed"
              />
            )
          )}
        </SectionCard>

        {/* Full table */}
        <SectionCard title="Todos os Characters — tabela detalhada">
          {!data ? <LoadingChart height={200} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs border-b border-white/5">
                    <th className="text-left py-2 pr-4">Character</th>
                    <th className="text-right pr-4">Mensagens</th>
                    <th className="text-right pr-4">Users únicos</th>
                    <th className="text-right pr-4">Média turnos</th>
                    <th className="text-right">Abandono</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((c: { agentId: string; name: string; totalMessages: number; uniqueUsers: number; avgConversationTurns: number; abandonmentRate: number }) => (
                    <tr key={c.agentId} className="border-t border-white/5 hover:bg-white/2">
                      <td className="py-2 pr-4 text-gray-200 font-medium">{c.name}</td>
                      <td className="pr-4 text-right text-gray-300 tabular-nums">{c.totalMessages.toLocaleString('pt-BR')}</td>
                      <td className="pr-4 text-right text-gray-400 tabular-nums">{c.uniqueUsers.toLocaleString('pt-BR')}</td>
                      <td className="pr-4 text-right text-gray-400 tabular-nums">{c.avgConversationTurns}</td>
                      <td className={`text-right tabular-nums ${c.abandonmentRate > 50 ? 'text-red-400' : 'text-gray-400'}`}>
                        {c.abandonmentRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  )
}
