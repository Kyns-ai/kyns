'use client'

import { useEffect, useRef } from 'react'
import { mutate } from 'swr'

export default function AutoRefresh() {
  const interval = parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL ?? '60000', 10)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      mutate((key) => typeof key === 'string' && key.startsWith('/api/analytics/'), undefined, { revalidate: true })
    }, interval)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [interval])

  return null
}
