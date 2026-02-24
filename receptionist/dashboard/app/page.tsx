import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">Reception</h1>
        <p className="text-muted-foreground mb-1 text-lg">Your AI receptionist. 24/7.</p>
        <p className="text-muted-foreground mb-8 text-sm">Every call answered. Every lead captured. Never miss a deal.</p>
        <div className="flex flex-col gap-3">
          <Link
            href="/demo"
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition"
          >
            Try it free — see it in action
          </Link>
          <Link
            href="/signup"
            className="w-full py-3 px-4 border border-primary/50 text-primary rounded-lg font-medium hover:bg-primary/10 transition"
          >
            Get my dedicated line — $79/mo
          </Link>
          <Link
            href="/login"
            className="w-full py-3 px-4 glass rounded-lg font-medium text-foreground hover:bg-white/10 transition text-sm"
          >
            Already have an account? Log in
          </Link>
        </div>
      </div>
    </div>
  )
}
