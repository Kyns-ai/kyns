import { clsx } from 'clsx'

interface Props {
  label: string
  value: string | number
  sub?: string
  trend?: number
  icon?: React.ReactNode
  accent?: boolean
}

export default function StatCard({ label, value, sub, trend, icon, accent }: Props) {
  return (
    <div className={clsx(
      'rounded-2xl p-5 border transition-all',
      accent
        ? 'bg-accent/10 border-accent/20'
        : 'bg-surface-800 border-white/5 hover:border-white/10'
    )}>
      <div className="flex items-start justify-between">
        <p className="text-sm text-gray-400 font-medium">{label}</p>
        {icon && (
          <div className={clsx(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            accent ? 'bg-accent/20' : 'bg-white/5'
          )}>
            {icon}
          </div>
        )}
      </div>
      <p className={clsx(
        'text-3xl font-bold mt-2 tabular-nums',
        accent ? 'text-accent-light' : 'text-white'
      )}>
        {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
      </p>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-2 mt-1.5">
          {sub && <p className="text-xs text-gray-500">{sub}</p>}
          {trend !== undefined && (
            <span className={clsx(
              'text-xs font-medium flex items-center gap-0.5',
              trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-gray-500'
            )}>
              {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
            </span>
          )}
        </div>
      )}
    </div>
  )
}
