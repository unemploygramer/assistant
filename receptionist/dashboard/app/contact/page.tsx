'use client'

import { useState } from 'react'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      toast.success('Message sent — we’ll get back to you soon.')
      setName('')
      setEmail('')
      setSubject('')
      setMessage('')
    } catch (err) {
      toast.error((err as Error).message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex items-center gap-3 mb-8">
          <Mail className="h-8 w-8 text-foreground" />
          <h1 className="text-3xl font-bold text-foreground">Contact</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Questions, partnerships, or want to buy us out? Drop a line — we read everything.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border glass p-6 shadow-sm sm:p-8">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white/5"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white/5"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-foreground mb-1">Subject (optional)</label>
            <input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white/5"
              placeholder="Partnership, pricing, etc."
            />
          </div>
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-foreground mb-1">Message</label>
            <textarea
              id="message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary bg-white/5 resize-none"
              placeholder="What's on your mind?"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {loading ? 'Sending...' : 'Send message'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Messages go to the team (Coded by Tyler). We’ll respond as soon as we can.
        </p>
      </div>
    </div>
  )
}
