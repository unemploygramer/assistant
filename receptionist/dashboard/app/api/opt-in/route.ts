import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Normalize phone to E.164 (basic)
function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return input.startsWith('+') ? input : `+${digits}`
}

// POST - SMS opt-in (public, no auth required)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, consent } = body

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }
    if (!consent) {
      return NextResponse.json({ error: 'You must agree to the Terms and Privacy Policy' }, { status: 400 })
    }

    const normalized = normalizePhone(phone.trim())
    if (normalized.length < 10) {
      return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('sms_opt_ins')
      .upsert(
        {
          phone: normalized,
          consent_source: 'web',
          consented_at: new Date().toISOString(),
        },
        { onConflict: 'phone', ignoreDuplicates: false }
      )

    if (error) {
      // Handle unique constraint - may need to update instead
      if (error.code === '23505') {
        return NextResponse.json({ success: true, message: 'Already opted in' })
      }
      console.error('[API opt-in]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
