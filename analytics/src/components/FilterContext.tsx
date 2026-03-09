'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type Period = '1d' | '7d' | '30d' | '90d'

interface FilterState {
  period: Period
  days: number
  setPeriod: (p: Period) => void
}

const FilterContext = createContext<FilterState>({
  period: '30d',
  days: 30,
  setPeriod: () => {},
})

const PERIOD_DAYS: Record<Period, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 }

export function FilterProvider({ children }: { children: ReactNode }) {
  const [period, setPeriodState] = useState<Period>('30d')
  const setPeriod = useCallback((p: Period) => setPeriodState(p), [])
  return (
    <FilterContext.Provider value={{ period, days: PERIOD_DAYS[period], setPeriod }}>
      {children}
    </FilterContext.Provider>
  )
}

export const useFilters = () => useContext(FilterContext)
