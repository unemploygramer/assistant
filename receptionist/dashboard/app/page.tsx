import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard/config')
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">AI Receptionist</h1>
        <p className="text-slate-600 mb-8">Manage your business and bot in one place.</p>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full py-3 px-4 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="w-full py-3 px-4 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}
