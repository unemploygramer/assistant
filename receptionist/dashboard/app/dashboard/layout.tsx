import { createClient } from '@/lib/supabase/server'
import { SyncStatus } from '@/components/SyncStatus'
import { DashboardSidebar } from '@/components/DashboardSidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      {/* Mobile: thin bar with status only */}
      <div className="lg:hidden sticky top-14 z-40 flex justify-end px-4 py-2 border-b border-white/10 bg-background/80 backdrop-blur-sm">
        <SyncStatus />
      </div>
      <main className="lg:pl-56 pt-0">
        {children}
      </main>
    </div>
  )
}
