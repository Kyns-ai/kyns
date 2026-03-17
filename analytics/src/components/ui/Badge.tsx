import { clsx } from 'clsx'

type Variant = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'purple'

const variants: Record<Variant, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  red: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
  yellow: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
  blue: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  gray: 'bg-white/5 text-gray-400 ring-1 ring-white/10',
  purple: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30',
}

interface BadgeProps {
  variant?: Variant
  children: React.ReactNode
  className?: string
}

export default function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}

export function statusBadge(status: string) {
  if (status === 'active' || status === 'online') return <Badge variant="green">{status === 'active' ? 'Ativo' : 'Online'}</Badge>
  if (status === 'banned' || status === 'offline') return <Badge variant="red">{status === 'banned' ? 'Banido' : 'Offline'}</Badge>
  if (status === 'inactive') return <Badge variant="yellow">Inativo</Badge>
  if (status === 'unknown') return <Badge variant="gray">Desconhecido</Badge>
  if (status === 'pending') return <Badge variant="yellow">Pendente</Badge>
  if (status === 'reviewed') return <Badge variant="green">Revisado</Badge>
  if (status === 'ignored') return <Badge variant="gray">Ignorado</Badge>
  return <Badge>{status}</Badge>
}
