import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Claim an available Twilio number from the pool and assign to current user's business
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's business profile
    const { data: profile, error: profileError } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }
    if (!profile) {
      return NextResponse.json(
        { error: 'No business profile found. Save your business name first, then claim a number.' },
        { status: 400 }
      )
    }

    // Find first available number
    const { data: available, error: findErr } = await supabase
      .from('twilio_numbers')
      .select('id, phone_number, sid')
      .eq('status', 'available')
      .limit(1)
      .maybeSingle()

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 })
    }
    if (!available) {
      return NextResponse.json(
        { error: 'No phone numbers available in the pool. Contact support to add more.' },
        { status: 503 }
      )
    }

    // Update pool: mark as assigned, link to business
    const { error: updatePoolErr } = await supabase
      .from('twilio_numbers')
      .update({
        status: 'assigned',
        business_profile_id: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', available.id)

    if (updatePoolErr) {
      return NextResponse.json({ error: updatePoolErr.message }, { status: 500 })
    }

    // Update business_profiles.twilio_phone_number
    const { error: updateProfileErr } = await supabase
      .from('business_profiles')
      .update({
        twilio_phone_number: available.phone_number,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (updateProfileErr) {
      // Rollback pool assignment on profile update failure
      await supabase
        .from('twilio_numbers')
        .update({ status: 'available', business_profile_id: null, updated_at: new Date().toISOString() })
        .eq('id', available.id)
      return NextResponse.json({ error: updateProfileErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      phoneNumber: available.phone_number,
      sid: available.sid,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
