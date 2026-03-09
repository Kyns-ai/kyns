'use client'

import { useFilters, type Period } from '../FilterContext'

const periods: { value: Period; label: string }[] = [
  { value: '1d', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
]

export default function Header({ title }: { title: string }) {
  const { period, setPeriod } = useFilters()

  return (
    <header className="sticky top-0 z-10 bg-surface-900/80 backdrop-blur border-b border-white/5 px-6 py-4 flex items-center justify-between">
      <h1 className="text-lg font-semibold text-white">{title}</h1>
      <div className="flex items-center gap-1 bg-surface-800 rounded-xl p-1 border border-white/5">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p.value
                ? 'bg-accent text-white shadow-lg'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </header>
  )
}
