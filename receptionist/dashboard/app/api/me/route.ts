import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) return NextResponse.json({ user: null })
    return NextResponse.json({
      user: user ? { id: user.id, email: user.email ?? undefined } : null,
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
