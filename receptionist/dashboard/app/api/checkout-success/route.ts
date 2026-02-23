import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

/** After Stripe Checkout success, retrieve session and update business_profiles. */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id')
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] })
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
    const subId = typeof session.subscription === 'object' && session.subscription?.id
      ? session.subscription.id
      : (typeof session.subscription === 'string' ? session.subscription : null)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let { data: profile } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (!profile) {
      const { data: created, error: insertErr } = await supabase
        .from('business_profiles')
        .insert({
          user_id: user.id,
          business_name: 'My Business',
          bot_config: { tone: 'professional', requiredLeadInfo: [], businessType: 'general', appointmentDetails: { serviceTypes: [], defaultDurationMinutes: 30, bookingRules: '' } },
          is_active: true,
          subscription_status: 'active',
          stripe_customer_id: customerId,
          stripe_subscription_id: subId,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (insertErr) {
        console.error('[checkout-success] insert profile failed', insertErr)
        return NextResponse.json({ error: 'Could not create business profile' }, { status: 500 })
      }
      profile = created
    } else {
      await supabase
        .from('business_profiles')
        .update({
          subscription_status: 'active',
          stripe_customer_id: customerId,
          stripe_subscription_id: subId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)
    }

    return NextResponse.json({ ok: true, subscription_status: 'active' })
  } catch (err) {
    console.error('[checkout-success]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
