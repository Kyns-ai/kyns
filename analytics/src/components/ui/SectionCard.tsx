interface Props {
  title: string
  subtitle?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export default function SectionCard({ title, subtitle, children, action, className = '' }: Props) {
  return (
    <div className={`bg-surface-800 rounded-2xl border border-white/5 overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
