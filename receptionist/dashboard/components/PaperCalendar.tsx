'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'

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

function CalendarGrid({ bookings, weekStart, isSample = false }: { bookings: Booking[]; weekStart: Date; isSample?: boolean }) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  function getBlocksForDay(day: Date) {
    return bookings.filter((b) => {
      const start = new Date(b.start_time)
      return start.toDateString() === day.toDateString()
    })
  }

  return (
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
                isSample ? 'bg-primary/15 text-primary/70 border border-primary/30 opacity-75' : 'bg-primary/30 text-primary border border-primary/50'
              }`}
            >
              {b.customer_name || 'Unknown'} · {b.service_type || '—'}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function PaperCalendar() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [exampleExpanded, setExampleExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/bookings')
      .then((r) => r.json())
      .then((d) => {
        setBookings(d.bookings ?? [])
      })
      .catch(() => setBookings([]))
  }, [])

  const hasRealData = bookings.length > 0
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  return (
    <div className="space-y-4">
      {/* Your Bookings - real data only */}
      <div className="glass rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-foreground">Your Bookings</h3>
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
        {hasRealData ? (
          <CalendarGrid bookings={bookings} weekStart={weekStart} />
        ) : (
          <>
            <CalendarGrid bookings={[]} weekStart={weekStart} />
            <p className="px-4 py-4 text-sm text-muted-foreground border-t border-white/10 text-center">
              No bookings yet. Appointments will appear here when callers book through your line.
            </p>
          </>
        )}
      </div>

      {/* Example Preview - separate, always sample data */}
      <div className="glass rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setExampleExpanded(!exampleExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-left border-b border-white/10 hover:bg-white/5 transition"
        >
          <span className="text-sm font-medium text-muted-foreground">Example preview</span>
          {exampleExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {exampleExpanded && (
          <>
            <p className="px-4 py-2 text-xs text-muted-foreground border-b border-white/10">
              This is what your calendar will look like when you have bookings.
            </p>
            <CalendarGrid bookings={SAMPLE_BOOKINGS} weekStart={weekStart} isSample />
          </>
        )}
      </div>
    </div>
  )
}
