'use client'

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

interface Cell { day: number; hour: number; count: number }

interface Props {
  data: Cell[]
}

export default function KHeatmap({ data }: Props) {
  const map: Record<string, number> = {}
  let max = 0
  for (const c of data) {
    map[`${c.day}-${c.hour}`] = c.count
    if (c.count > max) max = c.count
  }

  function getColor(count: number) {
    if (!count) return 'rgba(255,255,255,0.03)'
    const intensity = count / max
    return `rgba(124, 58, 237, ${0.1 + intensity * 0.9})`
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex ml-10 mb-1">
          {HOURS.filter((h) => h % 3 === 0).map((h) => (
            <div
              key={h}
              className="text-[10px] text-gray-500"
              style={{ width: `${100 / 24 * 3}%` }}
            >
              {h}h
            </div>
          ))}
        </div>
        {/* Grid */}
        {DAYS.map((day, di) => (
          <div key={day} className="flex items-center gap-1 mb-0.5">
            <span className="text-[10px] text-gray-500 w-8 text-right pr-1">{day}</span>
            <div className="flex-1 flex gap-0.5">
              {HOURS.map((h) => {
                const count = map[`${di + 1}-${h}`] ?? 0
                return (
                  <div
                    key={h}
                    className="flex-1 h-6 rounded-sm cursor-default"
                    style={{ background: getColor(count) }}
                    title={`${day} ${h}h: ${count} msgs`}
                  />
                )
              })}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[10px] text-gray-500">Menos</span>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((v) => (
            <div
              key={v}
              className="w-4 h-4 rounded-sm"
              style={{ background: `rgba(124, 58, 237, ${v})` }}
            />
          ))}
          <span className="text-[10px] text-gray-500">Mais</span>
        </div>
      </div>
    </div>
  )
}
