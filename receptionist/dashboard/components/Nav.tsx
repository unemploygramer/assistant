'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Menu, X, Phone, MessageSquare, Settings, FileText, Mail, Bell, LayoutDashboard } from 'lucide-react'
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
        ? 'bg-primary/20 text-primary'
        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
    )

  const publicLinks = [
    { href: '/demo', label: 'Demo', icon: Phone },
    { href: '/about', label: 'About', icon: FileText },
    { href: '/opt-in', label: 'SMS Signup', icon: Bell },
    { href: '/contact', label: 'Contact', icon: Mail },
  ]
  const dashboardLinks = [
    { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
    { href: '/dashboard/config', label: 'Config', icon: Settings },
    { href: '/dashboard/leads', label: 'Leads', icon: MessageSquare },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href={user ? '/dashboard' : '/'}
          className="flex items-center gap-2 font-semibold text-foreground"
        >
          <Phone className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">Reception</span>
        </Link>

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
              <div className="ml-4 flex items-center gap-3 border-l border-white/10 pl-4">
                <span className="max-w-[140px] truncate text-xs text-muted-foreground sm:max-w-[200px]">
                  {user.email}
                </span>
                <LogoutButton />
              </div>
            ) : (
              <div className="ml-4 flex items-center gap-2 border-l border-white/10 pl-4">
                <Link
                  href="/login"
                  className={cn('rounded-md px-3 py-2 text-sm font-medium', isActive('/login') ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground')}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Sign up
                </Link>
              </div>
            )
          )}
        </nav>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-card px-4 py-4 md:hidden">
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
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="truncate text-sm text-muted-foreground">{user.email}</span>
                <LogoutButton />
              </div>
            )}
            {!loading && !user && (
              <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                <Link
                  href="/login"
                  className="flex-1 rounded-md border border-white/10 py-2 text-center text-sm font-medium text-foreground hover:bg-white/5"
                  onClick={() => setMobileOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="flex-1 rounded-md bg-primary py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
