import Link from 'next/link'
import { Shield } from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy - AI Receptionist',
  description: 'Privacy Policy for AI Receptionist / Voicemail Assistant',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
            ← Home
          </Link>
        </div>
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-8">Last Updated: February 19, 2026</p>

        <article className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground">
              When you use our voicemail and phone receptionist service, we collect:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Call Data:</strong> Phone numbers, call duration, recordings/transcripts, and metadata</li>
              <li><strong>Business Information:</strong> Business name, calendar ID, configuration preferences</li>
              <li><strong>Lead Information:</strong> Names, phone numbers, addresses, and service requests from calls</li>
              <li><strong>Account Information:</strong> Email and authentication credentials for dashboard access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Process and route incoming phone calls</li>
              <li>Generate call transcripts and summaries</li>
              <li>Create and manage leads from conversations</li>
              <li>Send notifications (email and SMS) about leads and appointments</li>
              <li>Provide customer support and improve services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">3. Data Storage and Security</h2>
            <p className="text-muted-foreground">
              Data is stored using Supabase and Twilio. We implement industry-standard security measures.
              Call transcripts and lead data are retained as long as your account is active or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">4. Third-Party Services</h2>
            <p className="text-muted-foreground mb-2">We use:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Twilio:</strong> Phone and SMS</li>
              <li><strong>Supabase:</strong> Database and authentication</li>
              <li><strong>OpenRouter/OpenAI:</strong> AI call handling</li>
              <li><strong>ElevenLabs:</strong> Text-to-speech</li>
              <li><strong>Google Calendar:</strong> Appointment scheduling (if configured)</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              We do not sell or share your personal information with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">5. Your Rights</h2>
            <p className="text-muted-foreground">You have the right to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Access your personal data</li>
              <li>Request correction or deletion</li>
              <li>Opt out of SMS by replying STOP</li>
              <li>Request a copy of your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">6. Contact Us</h2>
            <p className="text-muted-foreground">
              Privacy questions? <strong>codedbytyler@gmail.com</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">7. Changes to This Policy</h2>
            <p className="text-muted-foreground">
              We may update this policy. Changes will be posted with an updated &quot;Last Updated&quot; date.
            </p>
          </section>
        </article>

        <div className="mt-12 pt-6 border-t border-border flex gap-4 text-sm">
          <Link href="/terms" className="text-muted-foreground hover:text-foreground underline">
            Terms and Conditions
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-foreground underline">
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
