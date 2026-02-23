import Link from 'next/link'
import { FileText } from 'lucide-react'

export const metadata = {
  title: 'Terms and Conditions - AI Receptionist',
  description: 'Terms and Conditions for AI Receptionist / Voicemail Assistant',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
            ← Home
          </Link>
        </div>
        <div className="flex items-center gap-3 mb-8">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Terms and Conditions</h1>
        </div>
        <p className="text-muted-foreground text-sm mb-8">Last Updated: February 19, 2026</p>

        <article className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">1. Program Description</h2>
            <p><strong>Program Name:</strong> Voicemail Assistant / AI Receptionist</p>
            <p className="text-muted-foreground">
              This service provides AI-powered phone receptionist and voicemail handling, including call transcription,
              lead capture, appointment scheduling, and automated notifications via email and SMS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">2. Message Frequency</h2>
            <p>You may receive SMS messages when:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>A new lead is captured from an incoming phone call</li>
              <li>An appointment is booked through the system</li>
              <li>Important updates about your account occur</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Message frequency varies based on call volume and activity. Typically, you may receive 0-10 messages per day.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">3. Message and Data Rates</h2>
            <p className="text-muted-foreground">
              Standard message and data rates may apply. Charges depend on your mobile carrier and plan. We are not
              responsible for any charges incurred from receiving SMS messages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">4. Opt-Out Instructions</h2>
            <div className="bg-amber-50 border-l-4 border-amber-400 p-4 my-4">
              <p className="font-medium text-foreground mb-2">To stop receiving SMS messages:</p>
              <ul className="list-disc pl-6 text-primary space-y-1">
                <li>Reply <strong>STOP</strong> to any message</li>
                <li>Reply <strong>HELP</strong> for assistance</li>
                <li>Contact us at codedbytyler@gmail.com to opt out</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                After opting out, you will receive a confirmation message. You may opt back in at any time by contacting us.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">5. Support Contact</h2>
            <p className="text-muted-foreground">
              For questions, support, or to opt out: <strong>codedbytyler@gmail.com</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">6. User Consent</h2>
            <p className="text-muted-foreground">
              By using this service and providing your phone number, you consent to receive automated SMS messages
              related to lead notifications, appointment confirmations, and service updates. You can withdraw consent
              at any time by replying <strong>STOP</strong> or contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">7. Service Availability</h2>
            <p className="text-muted-foreground">
              This service is provided &quot;as is&quot; and may be subject to downtime, maintenance, or interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">8. Compliance</h2>
            <p className="text-muted-foreground">
              Users are responsible for ensuring compliance with applicable laws regarding call recording, data privacy,
              and SMS marketing in their jurisdiction (e.g. TCPA in the United States).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">9. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              We are not liable for any damages arising from use of this service. Use at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">10. Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these terms at any time. Continued use constitutes acceptance of updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">11. Contact</h2>
            <p className="text-muted-foreground">
              Questions? Contact: <strong>codedbytyler@gmail.com</strong>
            </p>
          </section>
        </article>

        <div className="mt-12 pt-6 border-t border-border flex gap-4 text-sm">
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground underline">
            Privacy Policy
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-foreground underline">
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
