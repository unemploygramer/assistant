import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** Format E.164 to (XXX) XXX-XXXX for US */
function formatUS(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const ten = digits.length >= 10 ? digits.slice(-10) : digits
  if (ten.length < 10) return phone
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: row } = await supabase
      .from('twilio_numbers')
      .select('phone_number')
      .eq('is_demo', true)
      .limit(1)
      .maybeSingle()

    const number = row?.phone_number ?? process.env.DEMO_LINE ?? process.env.NEXT_PUBLIC_DEMO_LINE ?? null
    const display = number ? formatUS(number) : null
    return NextResponse.json({ number: number ?? null, display: display ?? '(555) 000-0000' })
  } catch (e) {
    const number = process.env.DEMO_LINE ?? process.env.NEXT_PUBLIC_DEMO_LINE ?? null
    const display = number ? formatUS(number) : '(555) 000-0000'
    return NextResponse.json({ number, display })
  }
}
