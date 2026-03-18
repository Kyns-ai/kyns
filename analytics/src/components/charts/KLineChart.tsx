'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

interface Series {
  key: string
  label: string
  color: string
}

interface Props {
  data: Array<Record<string, string | number>>
  series: Series[]
  xKey: string
  height?: number
  yFormatter?: (v: number) => string
}

const CustomTooltip = ({ active, payload, label, yFormatter }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  yFormatter?: (v: number) => string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-700 border border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-gray-400 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="font-medium" style={{ color: p.color }}>
          {p.name}: {yFormatter ? yFormatter(p.value) : p.value.toLocaleString('pt-BR')}
        </p>
      ))}
    </div>
  )
}

export default function KLineChart({ data, series, xKey, height = 250, yFormatter }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey={xKey}
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#6b7280', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={yFormatter}
          width={40}
        />
        <Tooltip content={<CustomTooltip yFormatter={yFormatter} />} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
