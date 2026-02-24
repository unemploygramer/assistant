'use client'

import { useState, useEffect } from 'react'
import { Radio } from 'lucide-react'

function formatPhone(phone: string) {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '')
  if (d.length >= 10) return `(${d.slice(-10, -7)}) ${d.slice(-7, -4)}-${d.slice(-4)}`
  return phone
}

export function SyncStatus() {
  const [demoLine, setDemoLine] = useState<string | null>(null)
  const [userLine, setUserLine] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetch('/api/demo-number').then((r) => r.json()), fetch('/api/config').then((r) => r.json())])
      .then(([demo, config]) => {
        if (demo.display) setDemoLine(demo.display)
        if (config.twilio_phone_number) setUserLine(formatPhone(config.twilio_phone_number))
      })
      .catch(() => {})
  }, [])

  const isUserLine = !!userLine
  const displayLine = userLine || demoLine || '—'

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs">
      <Radio className="h-3.5 w-3.5 text-secondary animate-pulse" />
      <span className="text-muted-foreground">Live</span>
      <span className="text-foreground font-medium">
        / Listening on {isUserLine ? 'your line' : 'demo'}: {displayLine}
      </span>
    </div>
  )
}
