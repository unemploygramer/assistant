import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">Baddie Assistant</h1>
        <p className="text-muted-foreground mb-8">$79/mo — Never miss a lead.</p>
        <div className="flex flex-col gap-3">
          <Link
            href="/demo"
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition"
          >
            Try demo
          </Link>
          <Link
            href="/login"
            className="w-full py-3 px-4 glass rounded-lg font-medium text-foreground hover:bg-white/10 transition"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="w-full py-3 px-4 border border-white/10 text-foreground rounded-lg font-medium hover:bg-white/5 transition"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}
