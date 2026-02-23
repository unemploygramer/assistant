import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Get last call info for the current user's business
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's business profile to find their Twilio number
    const { data: profile } = await supabase
      .from('business_profiles')
      .select('twilio_phone_number')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!profile?.twilio_phone_number) {
      return NextResponse.json({ lastCall: null, message: 'No Twilio number configured' })
    }

    // Get last call-ended log for this business line
    const { data: lastCall, error } = await supabase
      .from('call_ended_logs')
      .select('*')
      .eq('twilio_to_number', profile.twilio_phone_number)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('[API last-call GET] Supabase error', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ lastCall: lastCall || null })
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
