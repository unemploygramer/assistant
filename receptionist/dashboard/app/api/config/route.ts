import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/client'

// GET - Load config
export async function GET() {
  try {
    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('business_profiles')
      .select('business_name, bot_config')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ config: null })
    }

    return NextResponse.json({
      config: {
        businessName: data.business_name || '',
        tone: data.bot_config?.tone || 'professional',
        customKnowledge: data.bot_config?.customKnowledge || '',
        requiredLeadInfo: data.bot_config?.requiredLeadInfo || []
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Save config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessName, tone, customKnowledge, requiredLeadInfo } = body

    const supabase = createServerSupabase()

    const botConfig = {
      tone: tone || 'professional',
      customKnowledge: customKnowledge || '',
      requiredLeadInfo: requiredLeadInfo || []
    }

    const { data: existing } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (existing) {
      const { error } = await supabase
        .from('business_profiles')
        .update({
          business_name: businessName,
          bot_config: botConfig,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('business_profiles')
        .insert({
          business_name: businessName,
          bot_config: botConfig,
          is_active: true
        })

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
