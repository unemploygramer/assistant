'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X, Phone, MessageSquare, Settings, FileText, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogoutButton } from '@/app/dashboard/logout-button'

type User = { id: string; email?: string } | null

export function Nav() {
  const pathname = usePathname()
  const [user, setUser] = useState<User>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data) => setUser(data.user ?? null))
      .finally(() => setLoading(false))
  }, [])

  const isActive = (path: string) =>
    path === pathname || (path !== '/' && pathname.startsWith(path))

  const linkClass = (path: string) =>
    cn(
      'text-sm font-medium transition-colors rounded-md px-3 py-2',
      isActive(path)
        ? 'bg-slate-100 text-slate-900'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    )

  const publicLinks = [
    { href: '/about', label: 'About', icon: FileText },
    { href: '/contact', label: 'Contact', icon: Mail },
  ]
  const dashboardLinks = [
    { href: '/dashboard/config', label: 'Config', icon: Settings },
    { href: '/dashboard/leads', label: 'Leads', icon: MessageSquare },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href={user ? '/dashboard/config' : '/'}
          className="flex items-center gap-2 font-semibold text-slate-900"
        >
          <Phone className="h-5 w-5 text-slate-700" />
          <span className="hidden sm:inline">AI Receptionist</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {user && dashboardLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              <Icon className="mr-1.5 inline-block h-4 w-4" />
              {label}
            </Link>
          ))}
          {publicLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              <Icon className="mr-1.5 inline-block h-4 w-4" />
              {label}
            </Link>
          ))}
          {!loading && (
            user ? (
              <div className="ml-4 flex items-center gap-3 border-l border-slate-200 pl-4">
                <span className="max-w-[140px] truncate text-xs text-slate-500 sm:max-w-[200px]">
                  {user.email}
                </span>
                <LogoutButton />
              </div>
            ) : (
              <div className="ml-4 flex items-center gap-2 border-l border-slate-200 pl-4">
                <Link
                  href="/login"
                  className={cn('rounded-md px-3 py-2 text-sm font-medium', isActive('/login') ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Sign up
                </Link>
              </div>
            )
          )}
        </nav>

        {/* Mobile menu button */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {user && dashboardLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={linkClass(href)}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="mr-2 inline-block h-4 w-4" />
                {label}
              </Link>
            ))}
            {publicLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={linkClass(href)}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="mr-2 inline-block h-4 w-4" />
                {label}
              </Link>
            ))}
            {!loading && user && (
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="truncate text-sm text-slate-500">{user.email}</span>
                <LogoutButton />
              </div>
            )}
            {!loading && !user && (
              <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                <Link
                  href="/login"
                  className="flex-1 rounded-md border border-slate-200 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="flex-1 rounded-md bg-slate-900 py-2 text-center text-sm font-medium text-white hover:bg-slate-800"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign up
                </Link>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
