import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import path from 'path'
import fs from 'fs'

/**
 * Returns calendar setup info for the config page:
 * - serviceAccountEmail: The Google service account email users must share their calendar with
 * - getCalendarIdUrl: Link to Google Calendar settings to find calendar ID
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let serviceAccountEmail: string | null = null

    // 1. Check env first (for production deployments)
    const envEmail = process.env.CALENDAR_SERVICE_ACCOUNT_EMAIL
    if (envEmail?.trim()) {
      serviceAccountEmail = envEmail.trim()
    } else {
      // 2. Try to read from creds.json (receptionist/creds.json relative to dashboard, or same dir)
      try {
        const candidates = [
          path.join(process.cwd(), '..', 'creds.json'),
          path.join(process.cwd(), 'creds.json'),
        ]
        const credsPath = candidates.find((p) => fs.existsSync(p))
        if (credsPath) {
          const raw = fs.readFileSync(credsPath, 'utf8')
          const creds = JSON.parse(raw)
          if (creds.client_email) {
            serviceAccountEmail = creds.client_email
          }
        }
      } catch {
        // Ignore - creds may not exist or be inaccessible
      }
    }

    const getCalendarIdUrl = 'https://calendar.google.com/calendar/u/0/r/settings'
    const shareCalendarUrl = 'https://calendar.google.com/calendar/u/0/r/settings/addbyemail'

    return NextResponse.json({
      serviceAccountEmail,
      getCalendarIdUrl,
      shareCalendarUrl,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
