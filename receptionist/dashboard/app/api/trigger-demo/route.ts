import { NextRequest, NextResponse } from 'next/server'

const PHONE_SERVER_URL = process.env.PHONE_SERVER_URL || process.env.NEXT_PUBLIC_PHONE_SERVER_URL || 'https://voicemail.snaptabapp.com'

// POST - Proxy to phone server to trigger outbound demo call (no auth required for landing demo)
export async function POST(request: NextRequest) {
  console.log('[API trigger-demo] POST received')
  try {
    const body = await request.json().catch(() => ({}))
    console.log('[API trigger-demo] Body:', JSON.stringify(body))
    const customerNumber = body?.customerNumber ?? body?.phone ?? ''
    if (!customerNumber || typeof customerNumber !== 'string') {
      console.log('[API trigger-demo] Rejecting: missing or invalid customerNumber/phone')
      return NextResponse.json({ error: 'Missing customerNumber or phone' }, { status: 400 })
    }

    const url = `${PHONE_SERVER_URL.replace(/\/$/, '')}/trigger-demo`
    console.log('[API trigger-demo] Proxying to:', url)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerNumber: customerNumber.trim() }),
    })
    const text = await res.text()
    console.log('[API trigger-demo] Phone server response status:', res.status)
    console.log('[API trigger-demo] Phone server response (first 200 chars):', text.slice(0, 200))

    let data: { error?: string; sid?: string; message?: string }
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      console.error('[API trigger-demo] Phone server did not return JSON. Body starts with:', text.slice(0, 100))
      return NextResponse.json(
        { error: res.ok ? 'Invalid response from phone server' : `Phone server error (${res.status}). Is the tunnel running?` },
        { status: res.ok ? 500 : res.status }
      )
    }

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('[API trigger-demo] Error:', (error as Error).message)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
