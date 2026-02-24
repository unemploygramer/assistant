import Link from 'next/link'
import { Phone, Zap, Shield } from 'lucide-react'
//console log bs]
const test = "test"
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">About Reception</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Reception is your AI receptionist: it answers every call 24/7, captures every lead, and can check or book appointments — so you never miss a call or a deal.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-1 sm:gap-10">
          <div className="flex gap-4 rounded-xl border glass p-6 shadow-sm">
            <Phone className="h-8 w-8 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Your number, your brand</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                One Twilio number per business. Callers get a natural voice conversation and you get a lead and optional email/SMS when the call ends.
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-xl border glass p-6 shadow-sm">
            <Zap className="h-8 w-8 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Config in minutes</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Set business name, tone, custom knowledge, and required lead info in the dashboard. Connect a Google Calendar to offer availability and booking.
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-xl border glass p-6 shadow-sm">
            <Shield className="h-8 w-8 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold text-foreground">Calls and data</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Call audio is processed by your chosen providers (e.g. Twilio, OpenRouter, ElevenLabs). Transcripts and lead data are stored so you can review and follow up. By using the service you agree to your own compliance with applicable recording and privacy laws in your region.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-muted-foreground">
          <Link href="/contact" className="text-primary underline hover:text-foreground">Get in touch</Link>
          {' · '}
          <Link href="/" className="text-primary underline hover:text-foreground">Home</Link>
        </p>
      </div>
    </div>
  )
}
