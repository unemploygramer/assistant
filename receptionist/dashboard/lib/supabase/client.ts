import { createClient } from '@supabase/supabase-js'

// Uses SUPABASE_URL and SUPABASE_ANON_KEY (same as phone server)
export function createServerSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase env: SUPABASE_URL and SUPABASE_ANON_KEY')
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}
