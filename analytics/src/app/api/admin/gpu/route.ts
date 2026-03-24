import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'

const RUNPOD_GQL = 'https://api.runpod.io/graphql'
const POD_NAME = process.env.AGENT_POD_NAME ?? 'kyns-agent-gpu'

interface RunpodPort {
  privatePort: number
  publicPort: number
  type: string
}

interface RunpodGpu {
  id: string
  gpuUtilPercent: number
  memoryUtilPercent: number
}

interface RunpodPod {
  id: string
  name: string
  desiredStatus: string
  costPerHr: number
  dockerArgs: string
  runtime: {
    uptimeInSeconds: number
    ports: RunpodPort[]
    gpus: RunpodGpu[]
  } | null
  machine: {
    gpuDisplayName: string
    podHostId: string
  } | null
}

interface DeployedPod {
  id: string
  name: string
  desiredStatus: string
}

async function gql(query: string, variables?: Record<string, unknown>) {
  const apiKey = process.env.RUNPOD_API_KEY
  if (!apiKey) throw new Error('RUNPOD_API_KEY não configurada')
  const res = await fetch(`${RUNPOD_GQL}?api_key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15000),
  })
  const data = await res.json() as { data?: unknown; errors?: Array<{ message: string }> }
  if (data.errors?.length) throw new Error(data.errors[0].message)
  return data.data
}

async function findAgentPod(): Promise<RunpodPod | null> {
  const data = await gql(`{
    myself { pods {
      id name desiredStatus costPerHr dockerArgs
      runtime { uptimeInSeconds gpus { id gpuUtilPercent memoryUtilPercent } ports { privatePort publicPort type } }
      machine { gpuDisplayName podHostId }
    } }
  }`) as { myself: { pods: RunpodPod[] } }
  return data.myself.pods.find((p) => p.name === POD_NAME) ?? null
}

export async function GET(req: NextRequest) {
  try {
    if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!process.env.RUNPOD_API_KEY) {
      return NextResponse.json({ status: 'no_key', pod: null })
    }

    const pod = await findAgentPod()
    if (!pod) return NextResponse.json({ status: 'not_found', pod: null })

    const running = pod.runtime !== null && pod.desiredStatus === 'RUNNING'
    const proxyUrl = running ? `https://${pod.id}-8000.proxy.runpod.net/v1` : null

    let llmOnline = false
    if (proxyUrl) {
      try {
        const r = await fetch(`${proxyUrl}/models`, {
          headers: { Authorization: `Bearer ${process.env.AGENT_LLM_KEY ?? ''}` },
          signal: AbortSignal.timeout(5000),
        })
        llmOnline = r.ok
      } catch { /* offline */ }
    }

    return NextResponse.json({
      status: running ? 'running' : 'stopped',
      pod: {
        id: pod.id,
        name: pod.name,
        gpu: pod.machine?.gpuDisplayName ?? 'GPU',
        uptimeSeconds: pod.runtime?.uptimeInSeconds ?? 0,
        costPerHr: pod.costPerHr,
        gpuUtil: pod.runtime?.gpus?.[0]?.gpuUtilPercent ?? null,
        memUtil: pod.runtime?.gpus?.[0]?.memoryUtilPercent ?? null,
        proxyUrl,
        llmOnline,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!await isAuthenticated(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { action } = await req.json() as { action: string }

    if (action === 'stop') {
      const pod = await findAgentPod()
      if (!pod) return NextResponse.json({ error: 'Pod não encontrado' }, { status: 404 })
      await gql(`mutation { podStop(input: { podId: "${pod.id}" }) { id desiredStatus } }`)
      return NextResponse.json({ ok: true, message: 'Pod parado com sucesso.' })
    }

    if (action === 'terminate') {
      const pod = await findAgentPod()
      if (!pod) return NextResponse.json({ error: 'Pod não encontrado' }, { status: 404 })
      await gql(`mutation { podTerminate(input: { podId: "${pod.id}" }) }`)
      return NextResponse.json({ ok: true, message: 'Pod terminado.' })
    }

    if (action === 'start') {
      const gpuTypeId  = process.env.AGENT_GPU_TYPE_ID ?? 'NVIDIA H100 NVL'
      const llmKey     = process.env.AGENT_LLM_KEY ?? 'kyns-agent-key'
      const hfRepo     = process.env.AGENT_HF_REPO ?? 'llmfan46/Qwen3.5-35B-A3B-heretic-v2-GGUF'
      const hfFile     = process.env.AGENT_HF_FILE ?? 'Qwen3.5-35B-A3B-heretic-v2-Q4_K_M.gguf'
      const volumeId   = process.env.AGENT_VOLUME_ID

      const dockerArgs = [
        `--hf-repo ${hfRepo}`,
        `--hf-file ${hfFile}`,
        '--port 8000 --host 0.0.0.0',
        '--n-gpu-layers 999',
        '--ctx-size 2490368',
        '--parallel 19',
        '--cont-batching',
        '--cache-type-k q8_0',
        '--cache-type-v q8_0',
        `--api-key ${llmKey}`,
      ].join(' ')

      const input: Record<string, unknown> = {
        name: POD_NAME,
        imageName: 'ghcr.io/ggml-org/llama.cpp:server-cuda',
        gpuTypeId,
        cloudType: 'COMMUNITY',
        startJupyter: false,
        startSsh: false,
        dockerArgs,
        ports: '8000/http',
        volumeInGb: 0,
        containerDiskInGb: 10,
        gpuCount: 1,
        env: [{ key: 'LLAMA_CACHE', value: '/workspace/.cache' }],
        volumeMountPath: '/workspace',
      }
      if (volumeId) input.networkVolumeId = volumeId

      const data = await gql(`
        mutation Deploy($input: PodFindAndDeployOnDemandInput!) {
          podFindAndDeployOnDemand(input: $input) { id name desiredStatus }
        }
      `, { input }) as { podFindAndDeployOnDemand: DeployedPod }

      const newPod = data.podFindAndDeployOnDemand
      return NextResponse.json({
        ok: true,
        message: 'Pod criado! Aguarde ~3 min para o modelo carregar na VRAM.',
        podId: newPod.id,
        proxyUrl: `https://${newPod.id}-8000.proxy.runpod.net/v1`,
      })
    }

    if (action === 'test') {
      const pod = await findAgentPod()
      if (!pod?.runtime) return NextResponse.json({ error: 'Pod não está rodando' }, { status: 400 })

      const proxyUrl = `https://${pod.id}-8000.proxy.runpod.net/v1`
      const llmKey = process.env.AGENT_LLM_KEY ?? ''

      const t0 = Date.now()
      const res = await fetch(`${proxyUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${llmKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'any',
          messages: [{ role: 'user', content: 'Reply with exactly the word OK' }],
          max_tokens: 20,
          temperature: 0.1,
          chat_template_kwargs: { enable_thinking: false },
        }),
        signal: AbortSignal.timeout(60000),
      })
      const elapsed = Date.now() - t0

      if (!res.ok) return NextResponse.json({ error: `LLM retornou ${res.status}` }, { status: 502 })

      const d = await res.json() as {
        choices: Array<{ message: { content: string } }>
        timings: { predicted_per_second: number; prompt_per_second: number; prompt_ms: number }
      }
      return NextResponse.json({
        ok: true,
        response: d.choices[0]?.message?.content ?? '',
        tps: Math.round(d.timings?.predicted_per_second ?? 0),
        prefillTps: Math.round(d.timings?.prompt_per_second ?? 0),
        ttftMs: Math.round(d.timings?.prompt_ms ?? 0),
        totalMs: elapsed,
      })
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
