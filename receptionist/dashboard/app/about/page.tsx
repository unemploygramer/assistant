import Link from 'next/link'
import { Phone, Zap, Shield } from 'lucide-react'

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">About</h1>
        <p className="mt-4 text-lg text-slate-600">
          AI Receptionist answers your business line 24/7, captures leads, and can check or book calendar appointments — so you never miss a call or a deal.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-1 sm:gap-10">
          <div className="flex gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <Phone className="h-8 w-8 shrink-0 text-slate-700" />
            <div>
              <h2 className="font-semibold text-slate-900">Your number, your brand</h2>
              <p className="mt-2 text-sm text-slate-600">
                One Twilio number per business. Callers get a natural voice conversation and you get a lead and optional email/SMS when the call ends.
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <Zap className="h-8 w-8 shrink-0 text-slate-700" />
            <div>
              <h2 className="font-semibold text-slate-900">Config in minutes</h2>
              <p className="mt-2 text-sm text-slate-600">
                Set business name, tone, custom knowledge, and required lead info in the dashboard. Connect a Google Calendar to offer availability and booking.
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <Shield className="h-8 w-8 shrink-0 text-slate-700" />
            <div>
              <h2 className="font-semibold text-slate-900">Calls and data</h2>
              <p className="mt-2 text-sm text-slate-600">
                Call audio is processed by your chosen providers (e.g. Twilio, OpenRouter, ElevenLabs). Transcripts and lead data are stored so you can review and follow up. By using the service you agree to your own compliance with applicable recording and privacy laws in your region.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-slate-500">
          <Link href="/contact" className="text-slate-700 underline hover:text-slate-900">Get in touch</Link>
          {' · '}
          <Link href="/" className="text-slate-700 underline hover:text-slate-900">Home</Link>
        </p>
      </div>
    </div>
  )
}
