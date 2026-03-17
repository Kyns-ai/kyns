'use client'

interface Step { step: string; label: string; count: number; pct: number }

interface Props { data: Step[] }

const STEP_COLORS = ['#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#3b0764']

export default function KFunnelChart({ data }: Props) {
  if (!data.length) return <p className="text-gray-500 text-sm text-center py-8">Sem dados</p>

  const max = data[0]?.count ?? 1

  return (
    <div className="space-y-2">
      {data.map((step, i) => (
        <div key={step.step} className="flex items-center gap-3">
          <div className="w-36 text-xs text-gray-400 text-right shrink-0">{step.label}</div>
          <div className="flex-1 bg-surface-700/50 rounded-lg h-10 relative overflow-hidden">
            <div
              className="h-full rounded-lg flex items-center justify-end pr-3 transition-all"
              style={{
                width: `${(step.count / max) * 100}%`,
                background: STEP_COLORS[i % STEP_COLORS.length],
              }}
            >
              <span className="text-xs font-semibold text-white">{step.pct}%</span>
            </div>
          </div>
          <div className="w-20 text-xs text-gray-300 font-medium tabular-nums">
            {step.count.toLocaleString('pt-BR')}
          </div>
        </div>
      ))}
    </div>
  )
}
