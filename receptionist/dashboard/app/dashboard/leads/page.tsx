'use client'

import { useState, useEffect } from 'react'
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
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Page header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-200">
              <MessageSquare className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Leads</h1>
              <p className="mt-0.5 text-sm text-slate-600 sm:text-base">
                View and manage leads from your phone line
              </p>
            </div>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
            <MessageSquare className="mx-auto mb-4 h-12 w-12 text-slate-300" />
            <h2 className="text-lg font-semibold text-slate-900">No leads yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-slate-600">
              Leads from phone calls will show here once calls start coming in.
            </p>
            <div className="mx-auto mt-6 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">
              <p className="font-medium">How leads are linked to you</p>
              <p className="mt-1 text-amber-800">
                Leads appear only for calls to <strong>your</strong> Twilio number (set in Config).
              </p>
              {configTwilioNumber ? (
                <p className="mt-2 text-amber-800">
                  Your line: <strong>{configTwilioNumber}</strong>. If you expect leads here, set Config → Twilio number to the number that receives your calls.
                </p>
              ) : (
                <p className="mt-2 text-amber-800">
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
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-slate-900">
                        <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="font-medium">{formatPhone(lead.phone)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                        {formatSummary(lead.summary)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(lead.created_at)}</p>
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
                          <h3 className="text-sm font-medium text-slate-700">Summary</h3>
                          <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                            {formatSummary(lead.summary)}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-slate-700">Full transcript</h3>
                          <div className="mt-1 max-h-[60vh] overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100 whitespace-pre-wrap">
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
            <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 bg-slate-50/80">
                      <TableHead className="font-semibold text-slate-700">Caller</TableHead>
                      <TableHead className="font-semibold text-slate-700">Summary</TableHead>
                      <TableHead className="font-semibold text-slate-700">Status</TableHead>
                      <TableHead className="font-semibold text-slate-700">Date</TableHead>
                      <TableHead className="w-[120px] font-semibold text-slate-700">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow key={lead.id} className="border-slate-100">
                        <TableCell className="font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-slate-400" />
                            {formatPhone(lead.phone)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-xs text-sm text-slate-700 line-clamp-2">
                            {formatSummary(lead.summary)}
                          </p>
                          {lead.industry && (
                            <p className="mt-0.5 text-xs text-slate-500">{lead.industry}</p>
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
                        <TableCell className="text-sm text-slate-600">
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
                                  <h3 className="text-sm font-medium text-slate-700">Summary</h3>
                                  <p className="mt-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                                    {formatSummary(lead.summary)}
                                  </p>
                                </div>
                                <div>
                                  <h3 className="text-sm font-medium text-slate-700">Full transcript</h3>
                                  <div className="mt-1 max-h-[60vh] overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-100 whitespace-pre-wrap">
                                    {lead.transcript || 'No transcript'}
                                  </div>
                                </div>
                                {lead.call_sid && (
                                  <p className="text-xs text-slate-500">Call SID: {lead.call_sid}</p>
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
