'use client'

import { createClient } from '@/lib/supabase/browser'

export function LogoutButton() {
  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }
  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-sm text-slate-600 hover:text-slate-900"
    >
      Log out
    </button>
  )
}
