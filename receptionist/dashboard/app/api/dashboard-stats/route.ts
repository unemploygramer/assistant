import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PIPELINE_VALUE_PER_LEAD = 250

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

    const businessId = profile?.id ?? null

    const leadsRes = await supabase.from('user_leads').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    let appointmentsSet = 0
    if (businessId) {
      try {
        const bookingsRes = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('business_id', businessId)
        appointmentsSet = (bookingsRes as { count?: number }).count ?? 0
      } catch {
        // bookings table may not exist yet
      }
    }

    const totalLeads = (leadsRes as { count?: number }).count ?? 0
    const pipelineValue = totalLeads * PIPELINE_VALUE_PER_LEAD

    return NextResponse.json({
      totalLeads,
      appointmentsSet,
      pipelineValue,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
