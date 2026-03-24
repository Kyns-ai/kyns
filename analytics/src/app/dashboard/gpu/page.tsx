'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function fmtUptime(secs: number) {
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}min`
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m}min`
}

interface PodInfo {
  id: string
  name: string
  gpu: string
  uptimeSeconds: number
  costPerHr: number
  gpuUtil: number | null
  memUtil: number | null
  proxyUrl: string | null
  llmOnline: boolean
}

interface GpuStatus {
  status: 'running' | 'stopped' | 'not_found' | 'no_key'
  pod: PodInfo | null
}

interface TestResult {
  ok: boolean
  response?: string
  tps?: number
  prefillTps?: number
  ttftMs?: number
  totalMs?: number
  error?: string
}

function StatusBadge({ status, llmOnline }: { status: string; llmOnline?: boolean }) {
  if (status === 'running' && llmOnline) {
    return (
      <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        Rodando — LLM Online
      </span>
    )
  }
  if (status === 'running') {
    return (
      <span className="flex items-center gap-1.5 text-sm font-semibold text-yellow-400">
        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        Rodando — Carregando modelo...
      </span>
    )
  }
  if (status === 'stopped') {
    return (
      <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-400">
        <span className="w-2 h-2 rounded-full bg-gray-500" />
        Parado
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-500">
      <span className="w-2 h-2 rounded-full bg-gray-600" />
      Nenhum pod ativo
    </span>
  )
}

export default function GpuPage() {
  const { data, mutate, isLoading } = useSWR<GpuStatus>('/api/admin/gpu', fetcher, {
    refreshInterval: 20_000,
  })

  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [copied, setCopied] = useState(false)

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const action = useCallback(async (act: string) => {
    setLoading(act)
    if (act === 'test') setTestResult(null)
    try {
      const res = await fetch('/api/admin/gpu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act }),
      })
      const d = await res.json() as { ok?: boolean; message?: string; error?: string } & TestResult
      if (!res.ok || d.error) {
        showToast(d.error ?? 'Erro desconhecido', 'err')
      } else if (act === 'test') {
        setTestResult(d)
      } else {
        showToast(d.message ?? 'OK')
        await mutate()
      }
    } catch (e) {
      showToast(String(e), 'err')
    } finally {
      setLoading(null)
    }
  }, [mutate])

  const copyUrl = () => {
    if (!data?.pod?.proxyUrl) return
    navigator.clipboard.writeText(data.pod.proxyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const status = data?.status ?? 'not_found'
  const pod = data?.pod ?? null
  const running = status === 'running'
  const costSession = pod ? (pod.uptimeSeconds / 3600) * pod.costPerHr : 0

  return (
    <>
      <Header title="GPU — Agentes" />

      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${
          toast.type === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="p-6 space-y-5">

        {/* Status principal */}
        <div className="bg-surface-800 rounded-2xl border border-white/5 p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Status do pod</p>
              {isLoading
                ? <div className="h-5 w-40 bg-white/5 animate-pulse rounded" />
                : <StatusBadge status={status} llmOnline={pod?.llmOnline} />
              }
              {pod && (
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>{pod.gpu}</span>
                  {running && <span>uptime {fmtUptime(pod.uptimeSeconds)}</span>}
                  {running && <span className="text-yellow-400">${pod.costPerHr.toFixed(2)}/hr</span>}
                  {running && <span className="text-orange-400">sessão ~${costSession.toFixed(2)}</span>}
                  {pod.gpuUtil !== null && <span>GPU {pod.gpuUtil}%</span>}
                  {pod.memUtil !== null && <span>VRAM {pod.memUtil}%</span>}
                </div>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex items-center gap-2 flex-wrap">
              {status === 'not_found' || status === 'no_key' ? (
                <button
                  disabled={!!loading || status === 'no_key'}
                  onClick={() => action('start')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {loading === 'start' ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                    </svg>
                  )}
                  Criar Pod H100 NVL
                </button>
              ) : running ? (
                <>
                  <button
                    disabled={!!loading}
                    onClick={() => action('test')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                  >
                    {loading === 'test' ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    Testar LLM
                  </button>
                  <button
                    disabled={!!loading}
                    onClick={() => action('stop')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {loading === 'stop' ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 10h6v4H9z" />
                      </svg>
                    )}
                    Parar Pod
                  </button>
                </>
              ) : (
                <>
                  <button
                    disabled={!!loading}
                    onClick={() => action('start')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {loading === 'start' ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                      </svg>
                    )}
                    Ligar Pod
                  </button>
                  <button
                    disabled={!!loading}
                    onClick={() => action('terminate')}
                    className="text-xs px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Deletar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* URL do proxy */}
        {pod?.proxyUrl && (
          <SectionCard title="URL do Endpoint" subtitle="Use essa URL para conectar ao LLM">
            <div className="flex items-center gap-3">
              <code className="flex-1 text-xs text-accent bg-accent/5 border border-accent/10 px-3 py-2.5 rounded-lg truncate">
                {pod.proxyUrl}
              </code>
              <button
                onClick={copyUrl}
                className="shrink-0 px-3 py-2.5 text-xs bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
              >
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Adicione como <code className="bg-white/5 px-1 rounded">OPENAI_REVERSE_PROXY</code> no seu projeto.
              API Key: <code className="bg-white/5 px-1 rounded">AGENT_LLM_KEY</code> (variável de ambiente do dashboard).
            </p>
          </SectionCard>
        )}

        {/* Resultado do teste */}
        {testResult && (
          <SectionCard
            title="Resultado do Teste"
            subtitle={testResult.ok ? 'LLM respondeu com sucesso' : 'Falha no teste'}
          >
            {testResult.ok ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Resposta do modelo</p>
                  <p className="text-sm text-white font-medium">{testResult.response}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Decode', value: `${testResult.tps} tok/s` },
                    { label: 'Prefill', value: `${testResult.prefillTps} tok/s` },
                    { label: 'TTFT', value: `${((testResult.ttftMs ?? 0) / 1000).toFixed(2)}s` },
                    { label: 'Total', value: `${((testResult.totalMs ?? 0) / 1000).toFixed(1)}s` },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 bg-white/3 rounded-lg text-center">
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className="text-lg font-bold text-white mt-1">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-400">{testResult.error}</p>
            )}
          </SectionCard>
        )}

        {/* Instruções para a equipe */}
        <SectionCard title="Como usar" subtitle="Guia rápido para a equipe">
          <div className="space-y-3 text-sm">
            <div className="flex gap-3 p-3 bg-white/3 rounded-lg">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold shrink-0">1</span>
              <div>
                <p className="text-white font-medium">Ligar o pod</p>
                <p className="text-gray-500 text-xs mt-0.5">Clique em <strong className="text-gray-300">Criar Pod H100 NVL</strong> (ou Ligar). Aguarde ~3 minutos para o modelo carregar.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-white/3 rounded-lg">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold shrink-0">2</span>
              <div>
                <p className="text-white font-medium">Verificar se está pronto</p>
                <p className="text-gray-500 text-xs mt-0.5">Quando aparecer <strong className="text-emerald-400">LLM Online</strong>, clique em <strong className="text-gray-300">Testar LLM</strong> para confirmar.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-white/3 rounded-lg">
              <span className="w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold shrink-0">3</span>
              <div>
                <p className="text-white font-medium">Copiar a URL e usar</p>
                <p className="text-gray-500 text-xs mt-0.5">Copie a <strong className="text-gray-300">URL do Endpoint</strong> e configure no seu projeto como <code className="bg-white/10 px-1 rounded">OPENAI_REVERSE_PROXY</code>.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-white/3 rounded-lg">
              <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold shrink-0">4</span>
              <div>
                <p className="text-white font-medium">Desligar ao terminar</p>
                <p className="text-gray-500 text-xs mt-0.5">Clique em <strong className="text-red-400">Parar Pod</strong> quando terminar os testes. O modelo fica salvo no volume — próximo start carrega em ~3 min.</p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Configuração de env vars */}
        <SectionCard title="Variáveis de Ambiente Necessárias" subtitle="Configure no Railway para habilitar o painel">
          <div className="space-y-2 font-mono text-xs">
            {[
              ['RUNPOD_API_KEY', 'Já configurada', '✓ presente'],
              ['AGENT_LLM_KEY', 'API key do servidor llama.cpp', 'ex: kyns-agent-2026'],
              ['AGENT_VOLUME_ID', 'ID do network volume (RunPod)', 'ex: abc123de'],
              ['AGENT_GPU_TYPE_ID', 'GPU a usar (padrão: H100 NVL)', 'NVIDIA H100 NVL'],
              ['AGENT_POD_NAME', 'Nome do pod (padrão: kyns-agent-gpu)', 'kyns-agent-gpu'],
              ['AGENT_HF_REPO', 'Repo HuggingFace do modelo', 'llmfan46/Qwen3.5-35B-A3B-heretic-v2-GGUF'],
              ['AGENT_HF_FILE', 'Arquivo GGUF do modelo', 'Qwen3.5-35B-A3B-heretic-v2-Q4_K_M.gguf'],
            ].map(([varName, desc, example]) => (
              <div key={varName} className="flex items-center gap-3 p-2 bg-white/3 rounded">
                <code className="text-accent shrink-0 w-40">{varName}</code>
                <span className="text-gray-500 flex-1">{desc}</span>
                <code className="text-gray-600 shrink-0">{example}</code>
              </div>
            ))}
          </div>
        </SectionCard>

      </div>
    </>
  )
}
