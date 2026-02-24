import { NextRequest, NextResponse } from 'next/server'

const PHONE_SERVER_URL = process.env.PHONE_SERVER_URL || process.env.NEXT_PUBLIC_PHONE_SERVER_URL || 'https://voicemail.snaptabapp.com'

// GET: confirm route exists (e.g. curl http://localhost:3000/api/demo-voice)
export async function GET() {
  const url = `${PHONE_SERVER_URL.replace(/\/$/, '')}/demo-voice`
  return NextResponse.json({
    ok: true,
    route: 'demo-voice',
    message: 'POST with { message?, history? } to talk to the AI receptionist. This GET confirms the route is up.',
    phoneServerUrl: url,
  })
}

export async function POST(request: NextRequest) {
  const url = `${PHONE_SERVER_URL.replace(/\/$/, '')}/demo-voice`
  try {
    const body = await request.json().catch(() => ({}))
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      // If phone server returns 404, it likely doesn't have /demo-voice yet (e.g. not deployed)
      const message = res.status === 404
        ? `Phone server at ${url} returned 404. Start the phone server locally (port 3001) and set PHONE_SERVER_URL=http://localhost:3001 in .env.local, or deploy the server with the /demo-voice endpoint.`
        : (data?.error || data?.message || `Phone server returned ${res.status}`)
      return NextResponse.json({ error: message, ...data }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[demo-voice]', err)
    return NextResponse.json(
      { error: (err as Error).message || 'Phone server unavailable. Is it running? Set PHONE_SERVER_URL in .env.local (e.g. http://localhost:3001).' },
      { status: 500 }
    )
  }
}
