import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  await supabase.auth.getUser()
  return <div className="min-h-screen bg-slate-50">{children}</div>
}
