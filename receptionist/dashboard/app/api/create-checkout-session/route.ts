import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, isStripeConfigured, STRIPE_PRO_PRICE_ID } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json({ error: 'Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_PRICE_ID_MONTHLY to .env.local.' }, { status: 503 })
    }
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    const clientReferenceId = profile?.id ?? user.id
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
    const successUrl = `${baseUrl}/dashboard/checkout/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}/dashboard/config`

    const session = await stripe!.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: clientReferenceId,
      customer_email: user.email ?? undefined,
      metadata: { user_id: user.id },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    console.error('[create-checkout-session]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
