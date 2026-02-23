'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PhoneCall, MessageSquare, Calendar, Mail } from 'lucide-react'

export default function DemoPage() {
  const [demoDisplay, setDemoDisplay] = useState<string>('(XXX) XXX-XXXX')

  useEffect(() => {
    fetch('/api/demo-number')
      .then((res) => res.json())
      .then((data) => {
        if (data.display) setDemoDisplay(data.display)
      })
      .catch(() => {})
  }, [])

  const steps = [
    { icon: PhoneCall, title: 'You call', text: 'Call the number below.' },
    { icon: MessageSquare, title: 'AI gathers info', text: 'The bot asks for name, service needed, and preferred time.' },
    { icon: Calendar, title: 'AI books appointment', text: 'In demo mode we simulate a booking—no real calendar.' },
    { icon: Mail, title: 'You get a sample email', text: 'A "New Lead" email goes to our team so you see what customers get.' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold text-foreground text-center sm:text-4xl">
          Experience the Baddie AI Receptionist.
        </h1>
        <p className="mt-3 text-muted-foreground text-center">
          Call the number below to talk to the bot.
        </p>

        <div className="mt-10 glass rounded-2xl p-8 text-center">
          <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Call to test the bot</p>
          <a
            href={`tel:${demoDisplay.replace(/\D/g, '')}`}
            className="mt-2 block text-4xl font-bold text-primary tracking-tight sm:text-5xl hover:text-primary/80"
          >
            {demoDisplay}
          </a>
        </div>

        <section className="mt-16">
          <h2 className="text-xl font-bold text-foreground mb-6">How it works</h2>
          <ul className="space-y-6">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-4 glass rounded-xl p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {i + 1}. {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">{step.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          <Link href="/" className="underline hover:text-foreground">Back to home</Link>
        </p>
      </div>
    </div>
  )
}
