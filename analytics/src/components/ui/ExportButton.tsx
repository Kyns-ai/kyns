'use client'

import Papa from 'papaparse'

interface Props {
  data: object[]
  filename?: string
}

export default function ExportButton({ data, filename = 'export' }: Props) {
  function download() {
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}-${new Date().toISOString().substring(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!data || data.length === 0) return null

  return (
    <button
      onClick={download}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      CSV
    </button>
  )
}
