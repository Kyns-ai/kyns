'use client'

import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import StatCard from '@/components/ui/StatCard'
import type { EndpointStatus, MongoStats } from '@/lib/queries/admin-infrastructure'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function fmtBytes(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${(bytes / 1e3).toFixed(0)} KB`
}

function fmtUptime(secs: number) {
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  return `${d}d ${h}h`
}

function EndpointCard({ ep }: { ep: EndpointStatus }) {
  const isOnline = ep.status === 'online'
  const isUnknown = ep.status === 'unknown'
  return (
    <div className={`p-4 rounded-xl border transition-colors ${
      isOnline ? 'border-emerald-500/30 bg-emerald-500/5'
      : isUnknown ? 'border-white/10 bg-white/3'
      : 'border-red-500/30 bg-red-500/5'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-white">{ep.name}</p>
          <p className="text-xs text-gray-500 truncate max-w-xs">{ep.url}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            isOnline ? 'bg-emerald-400 animate-pulse' : isUnknown ? 'bg-gray-500' : 'bg-red-400'
          }`} />
          <span className={`text-xs font-medium ${
            isOnline ? 'text-emerald-400' : isUnknown ? 'text-gray-400' : 'text-red-400'
          }`}>
            {isOnline ? 'Online' : isUnknown ? 'Desconhecido' : 'Offline'}
          </span>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        {ep.latencyMs !== null && (
          <span className={ep.latencyMs < 500 ? 'text-emerald-400' : ep.latencyMs < 2000 ? 'text-yellow-400' : 'text-red-400'}>
            {ep.latencyMs}ms
          </span>
        )}
        {ep.error && <span className="text-red-400 truncate">{ep.error}</span>}
        <span className="ml-auto">{new Date(ep.lastChecked).toLocaleTimeString('pt-BR')}</span>
      </div>
    </div>
  )
}

export default function InfrastructurePage() {
  const { data, isLoading } = useSWR<{ endpoints: EndpointStatus[]; mongo: MongoStats | null }>(
    '/api/admin/infrastructure',
    fetcher,
    { refreshInterval: 30_000 }
  )

  const onlineCount = data?.endpoints.filter((e) => e.status === 'online').length ?? 0
  const totalCount = data?.endpoints.length ?? 0

  return (
    <>
      <Header title="Saúde da Infraestrutura" />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Serviços Online"
            value={isLoading ? '…' : `${onlineCount}/${totalCount}`}
            accent={onlineCount === totalCount && totalCount > 0}
            sub="endpoints monitorados"
          />
          {data?.mongo && (
            <>
              <StatCard label="Conexões MongoDB" value={data.mongo.connections.current} sub={`/${data.mongo.connections.current + data.mongo.connections.available} disponíveis`} />
              <StatCard label="Tamanho do Banco" value={fmtBytes(data.mongo.dataSize)} sub={`${fmtBytes(data.mongo.storageSize)} em disco`} />
              <StatCard label="Uptime MongoDB" value={fmtUptime(data.mongo.uptime)} sub={`${data.mongo.objects.toLocaleString()} documentos`} />
            </>
          )}
        </div>

        {/* Endpoints */}
        <SectionCard title="Endpoints" subtitle="Auto-refresh a cada 30 segundos">
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          )}
          {data?.endpoints.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">Nenhum endpoint configurado.</p>
              <p className="text-xs mt-1">Defina <code className="bg-white/5 px-1 rounded">VLLM_API_URL</code>, <code className="bg-white/5 px-1 rounded">IMAGE_API_URL</code> ou <code className="bg-white/5 px-1 rounded">LIBRECHAT_URL</code> nas variáveis de ambiente.</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data?.endpoints.map((ep) => (
              <EndpointCard key={ep.name} ep={ep} />
            ))}
          </div>
        </SectionCard>

        {/* MongoDB details */}
        {data?.mongo && (
          <SectionCard title="MongoDB" subtitle="Estatísticas do banco de dados">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Collections', data.mongo.collections],
                ['Documentos', data.mongo.objects.toLocaleString()],
                ['Dados', fmtBytes(data.mongo.dataSize)],
                ['Armazenamento', fmtBytes(data.mongo.storageSize)],
              ].map(([label, value]) => (
                <div key={label} className="p-3 bg-white/3 rounded-lg">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-lg font-semibold text-white mt-1">{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Env var hints */}
        <SectionCard title="Variáveis de Ambiente para Monitoramento" subtitle="Configure no Railway para habilitar monitoramento">
          <div className="space-y-2 font-mono text-xs">
            {[
              ['VLLM_API_URL', 'URL do endpoint vLLM (RunPod Text)', 'https://your-pod.runpod.net'],
              ['IMAGE_API_URL', 'URL do endpoint de imagens (RunPod Serverless)', 'https://api.runpod.ai/v2/your-id'],
              ['LIBRECHAT_URL', 'URL do LibreChat (Railway)', 'https://chat.kyns.ai'],
              ['RUNPOD_API_KEY', 'API Key do RunPod para custo', 'sua_api_key_runpod'],
            ].map(([varName, desc, example]) => (
              <div key={varName} className="flex items-start gap-3 p-2 bg-white/3 rounded">
                <code className="text-accent shrink-0">{varName}</code>
                <span className="text-gray-500">{desc}</span>
                <code className="text-gray-600 ml-auto shrink-0">{example}</code>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  )
}
