'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { toast } from 'sonner'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = (() => {
    if (!rawNext || rawNext === '/dashboard') return '/dashboard'
    if (rawNext.startsWith('/') && !rawNext.startsWith('//')) return rawNext
    return '/dashboard'
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!data.session) throw new Error('No session returned')
      toast.success('Signed in — redirecting...')
      await new Promise((r) => setTimeout(r, 400))
      window.location.replace(next)
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full glass rounded-xl p-8">
        <h1 className="text-xl font-bold text-foreground mb-6">Log in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-white/10 rounded-lg bg-white/5 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-white/10 rounded-lg bg-white/5 focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          No account? <Link href="/signup" className="text-primary hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full glass rounded-xl p-8 animate-pulse">
          <div className="h-7 bg-white/10 rounded w-24 mb-6" />
          <div className="space-y-4">
            <div className="h-10 bg-white/5 rounded" />
            <div className="h-10 bg-white/5 rounded" />
            <div className="h-11 bg-white/10 rounded" />
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
