import { FilterProvider } from '@/components/FilterContext'
import Sidebar from '@/components/layout/Sidebar'
import AutoRefresh from '@/components/AutoRefresh'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <FilterProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          <AutoRefresh />
          {children}
        </main>
      </div>
    </FilterProvider>
  )
}
