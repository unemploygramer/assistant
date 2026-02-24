'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function OptInPage() {
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) {
      toast.error('Please agree to the Terms and Privacy Policy to continue.')
      return
    }
    if (!phone.trim()) {
      toast.error('Please enter your phone number.')
      return
    }
    setLoading(true)
    setSuccess(false)
    try {
      const res = await fetch('/api/opt-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), consent: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to sign up')
      setSuccess(true)
      setPhone('')
      setConsent(false)
      toast.success('You\'re signed up! You\'ll receive SMS updates.')
    } catch (err) {
      toast.error((err as Error).message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full glass rounded-xl border border-white/10 shadow-sm p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-secondary mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">You're all set!</h1>
          <p className="text-muted-foreground mb-6">
            You've opted in to receive SMS updates. Reply STOP to any message to opt out.
          </p>
          <Link
            href="/"
            className="text-foreground font-medium hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex items-center gap-3 mb-8">
          <MessageSquare className="h-8 w-8 text-foreground" />
          <h1 className="text-3xl font-bold text-foreground">SMS Updates Signup</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Get an instant text for every new lead. Enter your number below—we only text when something matters.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-white/10 glass p-6 shadow-sm sm:p-8">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+1 (555) 123-4567"
              className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">E.164 format (e.g. +15551234567)</p>
          </div>

          <div className="flex items-start gap-3">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
              className="mt-1 h-4 w-4 rounded border-white/10 text-foreground focus:ring-primary"
            />
            <label htmlFor="consent" className="text-sm text-foreground">
              By signing up, you agree to our{' '}
              <Link href="/terms" className="text-foreground underline hover:text-foreground">
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-foreground underline hover:text-foreground">
                Privacy Policy
              </Link>
              . Message and data rates may apply. Reply STOP to opt out.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing up...
              </>
            ) : (
              'Sign up for SMS updates'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/privacy" className="underline hover:text-foreground">Privacy</Link>
          {' · '}
          <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
        </p>
      </div>
    </div>
  )
}
