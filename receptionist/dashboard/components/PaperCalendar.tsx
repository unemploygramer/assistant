'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Booking {
  id: string
  customer_name: string | null
  customer_phone: string
  start_time: string
  service_type: string | null
  status: string
}

const SAMPLE_BOOKINGS: Booking[] = [
  { id: 's1', customer_name: 'Sample', customer_phone: '+15551234567', start_time: new Date().toISOString(), service_type: 'Consultation', status: 'pending' },
  { id: 's2', customer_name: 'Demo', customer_phone: '+15559876543', start_time: new Date(Date.now() + 86400000).toISOString(), service_type: 'Service', status: 'confirmed' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function PaperCalendar() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
  })

  useEffect(() => {
    fetch('/api/bookings')
      .then((r) => r.json())
      .then((d) => {
        if (d.bookings?.length) setBookings(d.bookings)
        else setBookings(SAMPLE_BOOKINGS)
      })
      .catch(() => setBookings(SAMPLE_BOOKINGS))
  }, [])

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const hasRealData = bookings.some((b) => !b.id.startsWith('s'))
  const displayBookings = hasRealData ? bookings : SAMPLE_BOOKINGS

  function getBlocksForDay(day: Date) {
    return displayBookings.filter((b) => {
      const start = new Date(b.start_time)
      return start.toDateString() === day.toDateString()
    })
  }

  return (
    <div className="glass rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-foreground">Paper Trading Calendar</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const d = new Date(weekStart)
              d.setDate(d.getDate() - 7)
              setWeekStart(d)
            }}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground min-w-[140px] text-center">
            {weekStart.toLocaleDateString(undefined, { month: 'short' })} {weekStart.getDate()} – {weekEnd.getDate()}
          </span>
          <button
            onClick={() => {
              const d = new Date(weekStart)
              d.setDate(d.getDate() + 7)
              setWeekStart(d)
            }}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-white/5 p-2">
        {DAYS.map((d) => (
          <div key={d} className="text-center py-2 text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {weekDays.map((day) => (
          <div key={day.toISOString()} className="min-h-[80px] bg-card/50 rounded p-2 space-y-2">
            <p className="text-xs text-muted-foreground">{day.getDate()}</p>
            {getBlocksForDay(day).map((b) => (
              <div
                key={b.id}
                className={`rounded px-2 py-1 text-xs font-medium truncate ${
                  hasRealData ? 'bg-primary/30 text-primary border border-primary/50' : 'bg-primary/15 text-primary/70 border border-primary/30 opacity-75'
                }`}
              >
                {b.customer_name || 'Unknown'} · {b.service_type || '—'}
              </div>
            ))}
          </div>
        ))}
      </div>
      {!hasRealData && (
        <p className="px-4 py-2 text-xs text-muted-foreground border-t border-white/10">
          Sample data. Real bookings will appear when the bot creates them.
        </p>
      )}
    </div>
  )
}
