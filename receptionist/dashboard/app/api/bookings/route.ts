import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
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

    if (!profile) {
      return NextResponse.json({ bookings: [] })
    }

    const { data, error } = await supabase
      .from('bookings')
      .select('id, customer_name, customer_phone, start_time, end_time, service_type, status, lead_id')
      .eq('business_id', profile.id)
      .order('start_time', { ascending: true })

    if (error) {
      // Table may not exist yet (run migrations/bookings_table.sql) — return empty
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ bookings: [] })
      }
      console.error('[API bookings]', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ bookings: data ?? [] })
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
