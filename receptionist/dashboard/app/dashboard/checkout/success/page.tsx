'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    if (!sessionId) {
      setStatus('error')
      setMessage('Missing session ID')
      return
    }
    fetch(`/api/checkout-success?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to activate subscription')
        setStatus('ok')
        setMessage('Subscription active!')
        setTimeout(() => router.replace('/dashboard'), 2000)
      })
      .catch((err) => {
        setStatus('error')
        setMessage(err.message || 'Something went wrong')
      })
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {status === 'loading' && (
        <>
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-muted-foreground">Activating your subscription…</p>
        </>
      )}
      {status === 'ok' && (
        <>
          <CheckCircle2 className="w-12 h-12 text-secondary mb-4" />
          <p className="text-foreground font-medium">{message}</p>
          <p className="text-sm text-muted-foreground mt-1">Redirecting to dashboard…</p>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="text-destructive font-medium">{message}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Back to Dashboard
          </button>
        </>
      )}
    </div>
  )
}
