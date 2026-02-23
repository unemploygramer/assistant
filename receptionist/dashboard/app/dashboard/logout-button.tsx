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
      className="text-sm text-muted-foreground hover:text-foreground"
    >
      Log out
    </button>
  )
}
