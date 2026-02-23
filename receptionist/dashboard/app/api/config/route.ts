import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Load config for the current user's business
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.log('[API config GET] no user', { userError: userError?.message })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[API config GET] user', { id: user.id, email: user.email })

    const { data, error } = await supabase
      .from('business_profiles')
      .select('business_name, bot_config, twilio_phone_number, calendar_id, owner_phone, updated_at, subscription_status, stripe_customer_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.log('[API config GET] Supabase error', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      console.log('[API config GET] no profile for user_id', user.id)
      return NextResponse.json({ config: null, saved_at: null })
    }

    const botConfig = data.bot_config as Record<string, unknown> | null
    const payload = {
      config: {
        businessName: data.business_name || '',
        tone: (botConfig?.tone as string) || 'professional',
        customKnowledge: (botConfig?.customKnowledge as string) || '',
        requiredLeadInfo: (botConfig?.requiredLeadInfo as string[]) || [],
        businessType: (botConfig?.businessType as string) || 'general',
        appointmentDetails: (botConfig?.appointmentDetails as { serviceTypes?: string[]; defaultDurationMinutes?: number; bookingRules?: string }) || { serviceTypes: [], defaultDurationMinutes: 30, bookingRules: '' },
      },
      twilio_phone_number: data.twilio_phone_number ?? null,
      calendar_id: data.calendar_id ?? (botConfig?.google_calendar_id as string) ?? null,
      owner_phone: data.owner_phone ?? null,
      saved_at: data.updated_at ?? null,
      subscription_status: data.subscription_status ?? null,
    }
    console.log('[API config GET] returning profile', { business_name: data.business_name, twilio_phone_number: data.twilio_phone_number, owner_phone: data.owner_phone, calendar_id: data.calendar_id })
    return NextResponse.json(payload)
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

// POST - Save config for the current user's business
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { businessName, tone, customKnowledge, requiredLeadInfo, twilio_phone_number, calendar_id, owner_phone, businessType, appointmentDetails } = body

    const botConfig = {
      tone: tone || 'professional',
      customKnowledge: customKnowledge || '',
      requiredLeadInfo: requiredLeadInfo || [],
      ...(calendar_id != null && { google_calendar_id: calendar_id }),
      ...(businessType != null && { businessType: businessType || 'general' }),
      ...(appointmentDetails != null && { appointmentDetails: appointmentDetails || { serviceTypes: [], defaultDurationMinutes: 30, bookingRules: '' } }),
    }

    const { data: existing } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('business_profiles')
        .update({
          business_name: businessName,
          bot_config: botConfig,
          twilio_phone_number: twilio_phone_number ?? null,
          calendar_id: calendar_id ?? null,
          owner_phone: owner_phone ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('business_profiles')
        .insert({
          user_id: user.id,
          business_name: businessName,
          bot_config: botConfig,
          twilio_phone_number: twilio_phone_number ?? null,
          calendar_id: calendar_id ?? null,
          owner_phone: owner_phone ?? null,
          is_active: true,
        })

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
