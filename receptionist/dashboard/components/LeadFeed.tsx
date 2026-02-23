'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Phone, FileText, AlertTriangle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

type SummaryObj = Record<string, unknown> | null
interface Lead {
  id: string
  phone: string
  transcript: string | null
  summary: string | SummaryObj | null
  status: string
  created_at: string
}

function formatPhone(phone: string) {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '')
  if (d.length >= 10) return `(${d.slice(-10, -7)}) ${d.slice(-7, -4)}-${d.slice(-4)}`
  return phone
}

function formatSummary(s: Lead['summary']): string {
  if (!s) return 'No summary'
  if (typeof s === 'string') return s
  const parts: string[] = []
  if (s.customerName) parts.push(String(s.customerName))
  if (s.serviceNeeded) parts.push(String(s.serviceNeeded))
  if (s.urgency) parts.push(String(s.urgency))
  return parts.length ? parts.join(' · ') : '—'
}

function isHighUrgency(s: Lead['summary']): boolean {
  if (!s || typeof s !== 'object') return false
  return String((s as Record<string, unknown>).urgency || '').toLowerCase() === 'high'
}

export function LeadFeed() {
  const [leads, setLeads] = useState<Lead[]>([])

  useEffect(() => {
    fetch('/api/leads')
      .then((r) => r.json())
      .then((d) => setLeads((d.leads || []).slice(0, 10)))
      .catch(() => {})
  }, [])

  return (
    <div className="glass rounded-lg border border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          Lead Feed
        </h3>
      </div>
      <div className="max-h-[400px] overflow-y-auto divide-y divide-white/5">
        {leads.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No leads yet</div>
        ) : (
          leads.map((lead) => {
            const urgent = isHighUrgency(lead.summary)
            return (
              <div
                key={lead.id}
                className={`p-4 hover:bg-white/5 transition-colors ${urgent ? 'border-l-2 border-l-destructive animate-pulse' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {urgent && (
                      <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase bg-destructive/30 text-destructive rounded mb-1">
                        Critical
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {formatPhone(lead.phone)}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{formatSummary(lead.summary)}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <a
                    href={`tel:${lead.phone.replace(/\D/g, '')}`}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-primary/20 text-primary hover:bg-primary/30 transition"
                  >
                    <Phone className="h-3 w-3" />
                    Call Back
                  </a>
                  <Sheet>
                    <SheetTrigger asChild>
                      <button className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-white/10 text-foreground hover:bg-white/15 transition">
                        <FileText className="h-3 w-3" />
                        View Transcript
                      </button>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:max-w-lg bg-card border-white/10">
                      <SheetHeader>
                        <SheetTitle className="text-foreground">Transcript</SheetTitle>
                      </SheetHeader>
                      <div className="mt-4 space-y-3">
                        <p className="text-sm text-muted-foreground">{formatSummary(lead.summary)}</p>
                        <pre className="max-h-[60vh] overflow-auto rounded bg-background p-3 font-mono text-xs text-foreground whitespace-pre-wrap">
                          {lead.transcript || 'No transcript'}
                        </pre>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            )
          })
        )}
      </div>
      {leads.length > 0 && (
        <div className="p-2 border-t border-white/10">
          <Link
            href="/dashboard/leads"
            className="block text-center text-xs font-medium text-primary hover:text-primary/80 transition"
          >
            View all leads →
          </Link>
        </div>
      )}
    </div>
  )
}
