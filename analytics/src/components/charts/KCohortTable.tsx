'use client'

interface CohortRow {
  cohort: string; size: number
  week0: number; week1: number; week2: number; week3: number
  week4: number; week5: number; week6: number; week7: number
}

interface Props { data: CohortRow[] }

function cell(v: number) {
  if (v === -1) return { bg: 'bg-surface-700/30', text: '-' }
  if (v === 0) return { bg: 'bg-red-900/20', text: '0%' }
  const alpha = Math.min(v / 100, 1)
  const bg = `rgba(124, 58, 237, ${0.05 + alpha * 0.7})`
  const textClass = v > 50 ? 'text-white font-semibold' : v > 20 ? 'text-gray-200' : 'text-gray-400'
  return { bg, text: `${v}%`, textClass }
}

export default function KCohortTable({ data }: Props) {
  if (!data.length) return <p className="text-gray-500 text-sm text-center py-8">Dados insuficientes para análise de coorte</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500">
            <th className="text-left py-2 pr-4 font-medium">Coorte</th>
            <th className="text-right pr-3 font-medium">Users</th>
            {['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'].map((w) => (
              <th key={w} className="text-center px-2 py-2 font-medium w-14">{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const weeks = [row.week0, row.week1, row.week2, row.week3, row.week4, row.week5, row.week6, row.week7]
            return (
              <tr key={row.cohort} className="border-t border-white/5">
                <td className="py-2 pr-4 text-gray-300 font-medium">{row.cohort}</td>
                <td className="pr-3 text-right text-gray-400">{row.size.toLocaleString('pt-BR')}</td>
                {weeks.map((v, i) => {
                  const { bg, text, textClass } = cell(v)
                  return (
                    <td key={i} className="px-1 py-1">
                      <div
                        className={`rounded px-1 py-1.5 text-center ${textClass ?? 'text-gray-500'}`}
                        style={typeof bg === 'string' && bg.startsWith('rgba') ? { background: bg } : undefined}
                      >
                        {text}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
