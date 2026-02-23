import { createClient } from '@/lib/supabase/server'
import { SyncStatus } from '@/components/SyncStatus'
import Link from 'next/link'
import { LayoutDashboard } from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-14 z-40 flex items-center justify-between px-4 py-2 border-b border-white/10 bg-background/80 backdrop-blur-sm">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition"
        >
          <LayoutDashboard className="h-4 w-4" />
          Command Center
        </Link>
        <SyncStatus />
      </div>
      {children}
    </div>
  )
}
