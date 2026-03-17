'use client'
interface PaginationProps {
  page: number
  pages: number
  total: number
  limit: number
  onChange: (p: number) => void
}

export default function Pagination({ page, pages, total, limit, onChange }: PaginationProps) {
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
      <span>{start}–{end} de {total}</span>
      <div className="flex gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-2 py-1 rounded text-xs bg-white/5 hover:bg-white/10 disabled:opacity-40"
        >← Anterior</button>
        <span className="px-2 py-1 text-xs">{page} / {pages}</span>
        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="px-2 py-1 rounded text-xs bg-white/5 hover:bg-white/10 disabled:opacity-40"
        >Próximo →</button>
      </div>
    </div>
  )
}
