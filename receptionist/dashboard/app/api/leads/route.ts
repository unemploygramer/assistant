import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch all leads for the current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch leads via user_leads view (joins leads with business_profiles by user_id)
    const { data, error } = await supabase
      .from('user_leads')
      .select('id, phone, transcript, summary, status, industry, call_sid, from_number, created_at, business_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.log('[API leads GET] Supabase error', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ leads: data || [] })
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

// PATCH - Update lead status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { leadId, status } = body

    if (!leadId || !status) {
      return NextResponse.json({ error: 'leadId and status are required' }, { status: 400 })
    }

    // Verify the lead belongs to this user by checking user_leads view
    const { data: leadCheck } = await supabase
      .from('user_leads')
      .select('id')
      .eq('id', leadId)
      .eq('user_id', user.id)
      .single()

    if (!leadCheck) {
      return NextResponse.json({ error: 'Lead not found or unauthorized' }, { status: 404 })
    }

    // Update the lead status directly in leads table
    const { data, error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', leadId)
      .select()
      .single()

    if (error) {
      console.log('[API leads PATCH] Supabase error', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ lead: data })
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
