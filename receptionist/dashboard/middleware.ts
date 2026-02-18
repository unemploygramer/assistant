import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
      // Supabase SSR getItem() uses cookies.get(name) to read chunks; without this the server never sees the session
      get(name) {
        return request.cookies.get(name)?.value
      },
      set(name, value, options) {
        response.cookies.set(name, value, options ?? { path: '/' })
      },
      remove(name, options) {
        response.cookies.set(name, '', { ...options, maxAge: 0, path: '/' })
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthPage = pathname === '/login' || pathname === '/signup'
  const isDashboard = pathname.startsWith('/dashboard')

  if (pathname === '/dashboard') {
    const res = NextResponse.redirect(new URL('/dashboard/config', request.url))
    response.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, { path: '/' }))
    return res
  }
  if (isDashboard && !user && !isAuthPage) {
    const redirect = new URL('/login', request.url)
    redirect.searchParams.set('next', pathname)
    const res = NextResponse.redirect(redirect)
    response.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, { path: '/' }))
    return res
  }
  if (isAuthPage && user) {
    const res = NextResponse.redirect(new URL('/dashboard/config', request.url))
    response.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value, { path: '/' }))
    return res
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
