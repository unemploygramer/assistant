'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, MessageSquare, Phone } from 'lucide-react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

/** Summary from DB is JSONB: { customerName, phoneNumber, serviceNeeded, urgency, address, preferredCallback, ... } */
type SummaryObj = Record<string, unknown> | null
interface Lead {
  id: string
  phone: string
  transcript: string | null
  summary: string | SummaryObj | null
  status: string
  industry: string | null
  call_sid: string | null
  from_number: string | null
  created_at: string
  business_name: string | null
}

const STATUS_OPTIONS = ['new', 'contacted', 'closed', 'converted']

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const [selectedTranscript, setSelectedTranscript] = useState<string | null>(null)
  const [configTwilioNumber, setConfigTwilioNumber] = useState<string | null>(null)

  useEffect(() => {
    loadLeads()
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      const res = await fetch('/api/config')
      const data = await res.json()
      if (res.ok && data?.twilio_phone_number) {
        setConfigTwilioNumber(data.twilio_phone_number)
      }
    } catch {
      // ignore
    }
  }

  async function loadLeads() {
    try {
      setLoading(true)
      const res = await fetch('/api/leads')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load leads')
      }

      const list = data.leads || []
      console.log('[Leads] loaded', list.length, 'leads', list.length ? list : '')
      setLeads(list)
    } catch (error: unknown) {
      console.error('[Leads] load error:', error)
      toast.error((error as Error).message || 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(leadId: string, newStatus: string) {
    try {
      setUpdatingStatus(leadId)
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, status: newStatus }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status')
      }

      // Update local state
      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? { ...lead, status: newStatus } : lead))
      )
      toast.success('Status updated')
    } catch (error: unknown) {
      console.error('Error updating status:', error)
      toast.error((error as Error).message || 'Failed to update status')
    } finally {
      setUpdatingStatus(null)
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }

  function formatPhone(phone: string | null) {
    if (!phone) return '—'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  /** Summary is JSONB from DB (object). Turn it into a short string for table/sheet. */
  function formatSummary(summary: Lead['summary']): string {
    if (summary == null) return 'No summary available'
    if (typeof summary === 'string') return summary
    const obj = summary as Record<string, unknown>
    const parts: string[] = []
    if (obj.customerName) parts.push(String(obj.customerName))
    if (obj.serviceNeeded) parts.push(String(obj.serviceNeeded))
    if (obj.phoneNumber) parts.push(String(obj.phoneNumber))
    if (obj.urgency) parts.push(`Urgency: ${obj.urgency}`)
    if (obj.preferredCallback) parts.push(String(obj.preferredCallback))
    if (obj.address) parts.push(String(obj.address))
    return parts.length ? parts.join(' · ') : JSON.stringify(obj)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg glass shadow-sm border border-white/10">
              <MessageSquare className="h-5 w-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Leads</h1>
              <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">
                View and manage leads from your phone line
              </p>
            </div>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-xl border border-white/10 glass p-8 text-center shadow-sm sm:p-12">
            <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">No leads yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
              Leads from phone calls will show here once calls start coming in.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/dashboard/config"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
              >
                Set up your first lead flow
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-foreground hover:bg-white/5 transition"
              >
                Send a test call to yourself
              </Link>
            </div>
            <div className="mx-auto mt-6 max-w-md rounded-lg border border-primary/30 glass p-4 text-left text-sm text-foreground">
              <p className="font-medium">How leads are linked to you</p>
              <p className="mt-1 text-muted-foreground">
                Leads appear only for calls to <strong>your</strong> Twilio number (set in Config).
              </p>
              {configTwilioNumber ? (
                <p className="mt-2 text-muted-foreground">
                  Your line: <strong>{configTwilioNumber}</strong>. If you expect leads here, set Config → Twilio number to the number that receives your calls.
                </p>
              ) : (
                <p className="mt-2 text-muted-foreground">
                  Set your Twilio number in Config so new leads show here.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="space-y-4 sm:hidden">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-xl border border-white/10 glass p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-foreground">
                        <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{formatPhone(lead.phone)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {formatSummary(lead.summary)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(lead.created_at)}</p>
                    </div>
                    <Select
                      value={lead.status}
                      onValueChange={(value) => updateStatus(lead.id, value)}
                      disabled={updatingStatus === lead.id}
                    >
                      <SelectTrigger className="w-[110px] shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="mt-3 w-full">
                        View transcript
                      </Button>
                    </SheetTrigger>
                    <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                      <SheetHeader>
                        <SheetTitle>Call transcript</SheetTitle>
                        <SheetDescription>
                          {formatPhone(lead.phone)} · {formatDate(lead.created_at)}
                        </SheetDescription>
                      </SheetHeader>
                      <div className="mt-6 space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-foreground">Summary</h3>
                          <p className="mt-1 rounded-lg bg-background p-3 text-sm text-muted-foreground">
                            {formatSummary(lead.summary)}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-foreground">Full transcript</h3>
                          <div className="mt-1 max-h-[60vh] overflow-auto rounded-lg bg-background p-3 font-mono text-xs text-foreground whitespace-pre-wrap">
                            {lead.transcript || 'No transcript'}
                          </div>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-white/10 glass shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 bg-background/80">
                      <TableHead className="font-semibold text-foreground">Caller</TableHead>
                      <TableHead className="font-semibold text-foreground">Summary</TableHead>
                      <TableHead className="font-semibold text-foreground">Status</TableHead>
                      <TableHead className="font-semibold text-foreground">Date</TableHead>
                      <TableHead className="w-[120px] font-semibold text-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id} className="border-border">
                        <TableCell className="font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {formatPhone(lead.phone)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-xs text-sm text-foreground line-clamp-2">
                            {formatSummary(lead.summary)}
                          </p>
                          {lead.industry && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{lead.industry}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={lead.status}
                            onValueChange={(value) => updateStatus(lead.id, value)}
                            disabled={updatingStatus === lead.id}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(lead.created_at)}
                        </TableCell>
                        <TableCell>
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button variant="outline" size="sm">
                                View transcript
                              </Button>
                            </SheetTrigger>
                            <SheetContent className="sm:max-w-2xl overflow-y-auto">
                              <SheetHeader>
                                <SheetTitle>Call transcript</SheetTitle>
                                <SheetDescription>
                                  {formatPhone(lead.phone)} · {formatDate(lead.created_at)}
                                </SheetDescription>
                              </SheetHeader>
                              <div className="mt-6 space-y-4">
                                <div>
                                  <h3 className="text-sm font-medium text-foreground">Summary</h3>
                                  <p className="mt-1 rounded-lg bg-background p-3 text-sm text-muted-foreground">
                                    {formatSummary(lead.summary)}
                                  </p>
                                </div>
                                <div>
                                  <h3 className="text-sm font-medium text-foreground">Full transcript</h3>
                                  <div className="mt-1 max-h-[60vh] overflow-auto rounded-lg bg-background p-4 font-mono text-xs text-foreground whitespace-pre-wrap">
                                    {lead.transcript || 'No transcript'}
                                  </div>
                                </div>
                                {lead.call_sid && (
                                  <p className="text-xs text-muted-foreground">Call SID: {lead.call_sid}</p>
                                )}
                              </div>
                            </SheetContent>
                          </Sheet>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
