'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import StatCard from '@/components/ui/StatCard'
import KLineChart from '@/components/charts/KLineChart'
import KBarChart from '@/components/charts/KBarChart'
import LoadingChart from '@/components/ui/LoadingChart'
import ExportButton from '@/components/ui/ExportButton'
import type { LatencyOverview } from '@/lib/queries/latency'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const PERIODS = [
  { value: 1, label: '24h' },
  { value: 3, label: '3 dias' },
  { value: 7, label: '7 dias' },
]

function fmtMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

function latencyColor(ms: number): string {
  if (ms < 500) return 'text-emerald-400'
  if (ms < 2000) return 'text-yellow-400'
  return 'text-red-400'
}

export default function LatencyPage() {
  const [days, setDays] = useState(1)
  const { data } = useSWR<LatencyOverview>(
    `/api/analytics/latency?days=${days}`,
    fetcher,
    { refreshInterval: 60_000 }
  )

  return (
    <>
      <Header title="Latencia e Performance" />

      <div className="p-6 space-y-6">
        {/* Period selector */}
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                days === p.value ? 'bg-accent text-white' : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="P50" value={data ? fmtMs(data.p50) : '...'} sub="mediana" accent />
          <StatCard label="P95" value={data ? fmtMs(data.p95) : '...'} sub="percentil 95" />
          <StatCard label="P99" value={data ? fmtMs(data.p99) : '...'} sub="percentil 99" />
          <StatCard label="Media" value={data ? fmtMs(data.avgMs) : '...'} sub="tempo medio" />
          <StatCard label="Requests" value={data?.totalRequests?.toLocaleString('pt-BR') ?? '...'} sub="total no periodo" />
        </div>

        {/* Latency over time */}
        <SectionCard
          title="Latencia ao longo do tempo"
          subtitle="P50 vs P95 por hora"
          action={<ExportButton data={data?.latencyOverTime ?? []} filename="latency-over-time" />}
        >
          {!data ? <LoadingChart /> : (
            <KLineChart
              data={data.latencyOverTime}
              xKey="hour"
              series={[
                { key: 'p50', label: 'P50', color: '#10b981' },
                { key: 'p95', label: 'P95', color: '#f59e0b' },
              ]}
              yFormatter={(v) => fmtMs(v)}
            />
          )}
        </SectionCard>

        {/* By endpoint */}
        <SectionCard
          title="Latencia por endpoint"
          subtitle="Tempo medio de resposta (ms)"
          action={<ExportButton data={data?.byEndpoint ?? []} filename="latency-by-endpoint" />}
        >
          {!data ? <LoadingChart height={300} /> : (
            <KBarChart
              data={(data.byEndpoint ?? []).slice(0, 12).map((e) => ({
                name: e.endpoint.length > 30 ? e.endpoint.substring(0, 30) + '...' : e.endpoint,
                avgMs: e.avgMs,
              }))}
              xKey="name"
              barKey="avgMs"
              horizontal
              height={300}
              color="#7c3aed"
              label="ms (media)"
            />
          )}
        </SectionCard>

        {/* Slowest requests */}
        <SectionCard title="Requests mais lentos" subtitle="Top 20 por tempo de resposta">
          {!data && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          )}
          <div className="space-y-2">
            {data?.slowestRequests.map((r, i) => (
              <div key={`${r.path}-${i}`} className="p-3 bg-white/3 rounded-lg border border-white/5 flex items-center gap-3">
                <span className={`text-sm font-mono font-bold w-16 text-right ${latencyColor(r.durationMs)}`}>
                  {fmtMs(r.durationMs)}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  r.statusCode < 400 ? 'text-emerald-400 bg-emerald-500/10'
                  : r.statusCode < 500 ? 'text-yellow-400 bg-yellow-500/10'
                  : 'text-red-400 bg-red-500/10'
                }`}>
                  {r.statusCode}
                </span>
                <span className="text-xs text-gray-500 font-mono">{r.method}</span>
                <span className="text-xs text-gray-400 font-mono flex-1 truncate">{r.path}</span>
                <span className="text-xs text-gray-600 shrink-0">
                  {new Date(r.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  )
}
