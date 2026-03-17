'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'

interface Props {
  data: Array<Record<string, string | number>>
  barKey: string
  xKey: string
  color?: string
  height?: number
  horizontal?: boolean
  secondaryKey?: string
  secondaryColor?: string
  label?: string
  secondaryLabel?: string
}

export default function KBarChart({
  data, barKey, xKey, color = '#7c3aed', height = 250,
  horizontal = false, secondaryKey, secondaryColor = '#10b981',
  label, secondaryLabel
}: Props) {
  const Tooltip_ = ({ active, payload, label: lbl }: {
    active?: boolean
    payload?: Array<{ value: number; name: string; fill: string }>
    label?: string
  }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-surface-700 border border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
        <p className="text-gray-400 mb-1.5">{lbl}</p>
        {payload.map((p) => (
          <p key={p.name} className="font-medium" style={{ color: p.fill }}>
            {p.name}: {p.value.toLocaleString('pt-BR')}
          </p>
        ))}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          horizontal={!horizontal}
          vertical={horizontal}
        />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis dataKey={xKey} type="category" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.05)' }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          </>
        )}
        <Tooltip content={<Tooltip_ />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        {secondaryKey && <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />}
        <Bar dataKey={barKey} name={label ?? barKey} fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={40} />
        {secondaryKey && (
          <Bar dataKey={secondaryKey} name={secondaryLabel ?? secondaryKey} fill={secondaryColor} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={40} />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
