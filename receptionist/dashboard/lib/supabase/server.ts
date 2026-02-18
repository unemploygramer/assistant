import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env for server')
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Ignore in Server Components
        }
      },
      get(name) {
        return cookieStore.get(name)?.value
      },
      set(name, value, options) {
        try {
          cookieStore.set(name, value, options ?? { path: '/' })
        } catch {
          // Ignore in Server Components
        }
      },
      remove(name, options) {
        try {
          cookieStore.set(name, '', { ...options, maxAge: 0, path: '/' })
        } catch {
          // Ignore in Server Components
        }
      },
    },
  })
}
