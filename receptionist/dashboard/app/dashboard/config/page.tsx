'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Eye, Building2, Phone, CheckCircle2, XCircle, AlertCircle, RefreshCw, Smartphone, CreditCard, Calendar, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { buildSystemPrompt, type BotConfig, type AppointmentDetails, BUSINESS_TYPE_PRESETS } from '@/lib/prompt-builder'

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'direct', label: 'Direct' }
] as const

const LEAD_INFO_OPTIONS = [
  'Name',
  'Email',
  'Phone',
  'Service Type',
  'Urgency',
  'Address',
  'Preferred Callback',
  'Budget',
  'Timeline'
]

const BUSINESS_TYPE_OPTIONS = [
  { value: 'general', label: 'General / Other' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'strip_club', label: 'Strip club / Nightlife' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'salon', label: 'Salon / Spa' },
  { value: 'legal', label: 'Legal' },
  { value: 'medical', label: 'Medical' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'auto', label: 'Auto repair' },
  { value: 'custom', label: 'Custom (manual selection)' },
]

export default function ConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<BotConfig>({
    businessName: '',
    tone: 'professional',
    customKnowledge: '',
    requiredLeadInfo: [],
    businessType: 'general',
    appointmentDetails: { serviceTypes: [], defaultDurationMinutes: 30, bookingRules: '' }
  })
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [calendarId, setCalendarId] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [lastCall, setLastCall] = useState<any>(null)
  const [lastCallLoading, setLastCallLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [calendarSetup, setCalendarSetup] = useState<{ serviceAccountEmail: string | null; getCalendarIdUrl: string; shareCalendarUrl: string } | null>(null)
  const [calendarSetupExpanded, setCalendarSetupExpanded] = useState(false)

  // Load existing config once on mount (empty deps — do not add loadConfig to avoid re-run loops)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    console.log('[CONFIG] fetch starting GET /api/config')
    fetch('/api/config')
      .then((res) => {
        console.log('[CONFIG] fetch response', { status: res.status, ok: res.ok })
        return res.json().then((data) => ({ ok: res.ok, data }))
      })
      .then(({ ok, data }) => {
        if (cancelled) return
        console.log('[CONFIG] API response data', { ok, data })
        if (!ok) {
          console.log('[CONFIG] API returned error', data?.error)
          toast.error(data?.error || 'Failed to load configuration')
          return
        }
        if (data.config) {
          const c = data.config
          console.log('[CONFIG] setting config from API', c)
          setConfig({
            businessName: c.businessName ?? '',
            tone: c.tone ?? 'professional',
            customKnowledge: c.customKnowledge ?? '',
            requiredLeadInfo: c.requiredLeadInfo ?? [],
            businessType: c.businessType ?? 'general',
            appointmentDetails: c.appointmentDetails ?? { serviceTypes: [], defaultDurationMinutes: 30, bookingRules: '' }
          })
        } else {
          console.log('[CONFIG] no config in response (no profile yet)')
        }
        const twilio = data.twilio_phone_number ?? ''
        const owner = data.owner_phone ?? ''
        const calendar = data.calendar_id ?? ''
        const saved = data.saved_at ?? null
        console.log('[CONFIG] setting form fields', { twilio_phone_number: twilio, owner_phone: owner, calendar_id: calendar, saved_at: saved })
        setTwilioPhoneNumber(twilio)
        setOwnerPhone(owner)
        setCalendarId(calendar)
        setSavedAt(saved)
        setSubscriptionStatus(data.subscription_status ?? null)
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[CONFIG] fetch failed', error)
          toast.error(error?.message || 'Failed to load configuration')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // Fetch calendar setup info when user expands the section
  useEffect(() => {
    if (!calendarSetupExpanded || calendarSetup) return
    fetch('/api/calendar-setup')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setCalendarSetup({
            serviceAccountEmail: data.serviceAccountEmail ?? null,
            getCalendarIdUrl: data.getCalendarIdUrl ?? 'https://calendar.google.com/calendar/u/0/r/settings',
            shareCalendarUrl: data.shareCalendarUrl ?? 'https://calendar.google.com/calendar/u/0/r/settings/addbyemail',
          })
        }
      })
      .catch(() => {})
  }, [calendarSetupExpanded, calendarSetup])

  async function saveConfig() {
    try {
      setSaving(true)

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: config.businessName,
          tone: config.tone,
          customKnowledge: config.customKnowledge,
          requiredLeadInfo: config.requiredLeadInfo,
          businessType: config.businessType,
          appointmentDetails: config.appointmentDetails,
          twilio_phone_number: twilioPhoneNumber.trim() || null,
          owner_phone: ownerPhone.trim() || null,
          calendar_id: calendarId.trim() || null,
        })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to save')

      setSavedAt(new Date().toISOString())
      toast.success('Configuration saved successfully!')
    } catch (error: any) {
      console.error('Error saving config:', error)
      toast.error(error.message || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  function handleLeadInfoToggle(option: string) {
    setConfig(prev => ({
      ...prev,
      requiredLeadInfo: prev.requiredLeadInfo.includes(option)
        ? prev.requiredLeadInfo.filter(item => item !== option)
        : [...prev.requiredLeadInfo, option]
    }))
  }

  async function handleClaimNumber() {
    try {
      setClaiming(true)
      const res = await fetch('/api/claim-number', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to claim number')
      setTwilioPhoneNumber(data.phoneNumber)
      toast.success(`Claimed ${data.phoneNumber}. Callers can now reach you!`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to claim number')
    } finally {
      setClaiming(false)
    }
  }

  function handleBusinessTypeChange(value: string) {
    setConfig(prev => ({
      ...prev,
      businessType: value,
      requiredLeadInfo: value && value !== 'custom' && BUSINESS_TYPE_PRESETS[value]
        ? [...BUSINESS_TYPE_PRESETS[value]]
        : prev.requiredLeadInfo
    }))
  }

  function setAppointmentDetails(updates: Partial<AppointmentDetails>) {
    setConfig(prev => ({
      ...prev,
      appointmentDetails: { ...(prev.appointmentDetails ?? { serviceTypes: [], defaultDurationMinutes: 30, bookingRules: '' }), ...updates }
    }))
  }

  async function loadLastCall() {
    if (!twilioPhoneNumber) return
    setLastCallLoading(true)
    try {
      const res = await fetch('/api/last-call')
      const data = await res.json()
      if (res.ok) {
        setLastCall(data.lastCall)
      }
    } catch (error) {
      console.error('Failed to load last call:', error)
    } finally {
      setLastCallLoading(false)
    }
  }

  // Load last call when Twilio number is available
  useEffect(() => {
    if (twilioPhoneNumber && !loading) {
      loadLastCall()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twilioPhoneNumber, loading])

  const promptPreview = buildSystemPrompt({ config, includeExamples: true })
  const hasExistingSetup = !!(config.businessName?.trim() || twilioPhoneNumber?.trim() || ownerPhone?.trim() || calendarId?.trim() || savedAt)
  const savedAtLabel = savedAt
    ? new Date(savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">
              {hasExistingSetup ? 'Edit configuration' : 'Bot configuration'}
            </h1>
          </div>
          <p className="text-muted-foreground">
            {hasExistingSetup
              ? 'Update your AI receptionist and business details below. Changes are saved to your account.'
              : 'Set up your AI receptionist: business name, tone, and what to collect from callers.'}
          </p>
        </div>

        {/* No profile linked — explain the disconnect */}
        {!hasExistingSetup && (
          <div className="mb-6 p-4 glass rounded-lg text-sm text-foreground border border-primary/30">
            <p className="font-medium mb-1">No business profile linked to your account yet.</p>
            <p className="text-muted-foreground">
              The dashboard only loads the profile whose <code className="bg-muted px-1 rounded">user_id</code> matches your login.
              You can either: <strong>fill the form below and click Save</strong> to create a new profile, or in Supabase Table Editor open{' '}
              <code className="bg-muted px-1 rounded">business_profiles</code>, pick the row you want (e.g. the one with your Twilio number),
              and set its <code className="bg-muted px-1 rounded">user_id</code> to your user ID so this page loads that profile.
            </p>
          </div>
        )}

        {/* Current saved state summary */}
        {hasExistingSetup && (
          <div className="mb-6 p-4 glass rounded-lg">
            <h2 className="text-sm font-semibold text-foreground mb-3">Current setup (from Supabase)</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Business</dt>
                <dd className="font-medium text-foreground">{config.businessName || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Twilio number</dt>
                <dd className="font-medium text-foreground">{twilioPhoneNumber || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Your phone (SMS alerts)</dt>
                <dd className="font-medium text-foreground">{ownerPhone || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Calendar ID</dt>
                <dd className="font-medium text-foreground truncate" title={calendarId || undefined}>{calendarId || '—'}</dd>
              </div>
              {savedAtLabel && (
                <div>
                  <dt className="text-muted-foreground">Last saved</dt>
                  <dd className="font-medium text-foreground">{savedAtLabel}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Pricing / Upgrade */}
        <div className="mb-6 p-4 glass rounded-lg">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4" />
            Subscription
          </h2>
          {subscriptionStatus === 'active' ? (
            <p className="text-sm text-green-700 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Active — you’re on the Pro plan.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">Upgrade to Pro for full access. $99/month.</p>
              <button
                onClick={async () => {
                  setCheckoutLoading(true)
                  try {
                    const res = await fetch('/api/create-checkout-session', { method: 'POST' })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Failed to start checkout')
                    if (data.url) window.location.href = data.url
                    else toast.error('No checkout URL returned')
                  } catch (err: any) {
                    toast.error(err.message || 'Checkout failed')
                  } finally {
                    setCheckoutLoading(false)
                  }
                }}
                disabled={checkoutLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Upgrade — $99/mo
              </button>
            </div>
          )}
        </div>

        {/* Last Call Status */}
        {hasExistingSetup && twilioPhoneNumber && (
          <div className="mb-6 p-4 glass rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Last Call Status
              </h2>
              <button
                onClick={loadLastCall}
                disabled={lastCallLoading}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${lastCallLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {lastCallLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : lastCall ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {lastCall.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-secondary" />}
                  {lastCall.status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
                  {(lastCall.status === 'pending' || lastCall.status === 'processing') && <AlertCircle className="w-4 h-4 text-primary" />}
                  <span className="font-medium text-foreground">
                    Status: <span className={`${lastCall.status === 'completed' ? 'text-secondary' : lastCall.status === 'error' ? 'text-destructive' : 'text-primary'}`}>
                      {lastCall.status === 'completed' ? 'Completed' : lastCall.status === 'error' ? 'Error' : 'Processing'}
                    </span>
                  </span>
                </div>
                <div className="text-muted-foreground">
                  <div>Call SID: <code className="bg-muted px-1 rounded text-xs">{lastCall.call_sid}</code></div>
                  <div>Call Status: {lastCall.call_status || '—'}</div>
                  <div>Time: {new Date(lastCall.created_at).toLocaleString()}</div>
                  {lastCall.lead_id && <div className="text-secondary">✓ Lead saved (ID: {lastCall.lead_id})</div>}
                  {lastCall.email_sent && <div className="text-secondary">✓ Email sent</div>}
                  {lastCall.sms_sent && <div className="text-secondary">✓ SMS sent</div>}
                  {lastCall.error_message && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-800 text-xs">
                      <div className="font-medium">Error:</div>
                      <div>{lastCall.error_message}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No calls recorded yet. Make a test call to see status here.</div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Configuration Form */}
          <div className="space-y-6">
            <div className="glass rounded-lg p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">
                {hasExistingSetup ? 'Edit bot settings' : 'Bot settings'}
              </h2>

              {/* Business Name */}
              <div className="mb-6">
                <label htmlFor="businessName" className="block text-sm font-medium text-foreground mb-2">
                  Business Name
                </label>
                <input
                  id="businessName"
                  type="text"
                  value={config.businessName}
                  onChange={(e) => setConfig(prev => ({ ...prev, businessName: e.target.value }))}
                  placeholder="e.g., Acme Plumbing"
                  className="w-full px-4 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                />
              </div>

              {/* Twilio Phone Number (system-managed pool) */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Business phone number (system-managed)
                </label>
                {twilioPhoneNumber ? (
                  <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                    <Smartphone className="w-5 h-5 text-muted-foreground" />
                    <span className="font-mono text-foreground">{twilioPhoneNumber}</span>
                    <span className="text-xs text-muted-foreground">Callers dial this number</span>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={handleClaimNumber}
                      disabled={claiming || !config.businessName.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                      {claiming ? 'Claiming...' : 'Claim a phone number'}
                    </button>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Save your business name first, then claim a number from the pool. The system assigns numbers automatically.
                    </p>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {twilioPhoneNumber ? 'Managed by the system. Contact support to release or change.' : 'Numbers are assigned from a shared pool.'}
                </p>
              </div>

              {/* Your phone (SMS alerts) */}
              <div className="mb-6">
                <label htmlFor="ownerPhone" className="block text-sm font-medium text-foreground mb-2">
                  Your phone (SMS lead alerts)
                </label>
                <input
                  id="ownerPhone"
                  type="text"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="e.g., +17145551234"
                  className="w-full px-4 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                />
                <p className="mt-1 text-xs text-muted-foreground">We text this number when a new lead comes in (same time as email). E.164 format.</p>
              </div>

              {/* Google Calendar ID */}
              <div className="mb-6">
                <label htmlFor="calendarId" className="block text-sm font-medium text-foreground mb-2">
                  Google Calendar ID
                </label>
                <input
                  id="calendarId"
                  type="text"
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  placeholder="e.g., you@company.com or primary"
                  className="w-full px-4 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                />
                <p className="mt-1 text-xs text-muted-foreground">Calendar shared with your service account for booking.</p>

                {/* How to link your calendar */}
                <div className="mt-4 rounded-lg border border-white/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCalendarSetupExpanded(!calendarSetupExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-white/5 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      How to link your Google Calendar
                    </span>
                    {calendarSetupExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {calendarSetupExpanded && (
                    <div className="px-4 pb-4 pt-4 border-t border-white/10 space-y-3 text-sm text-muted-foreground">
                      <p className="text-foreground font-medium">Two steps:</p>
                      <ol className="list-decimal list-inside space-y-2">
                        <li>
                          <span className="text-foreground">Get your Calendar ID</span> — usually your Gmail address.
                          {' '}
                          <a
                            href={calendarSetup?.getCalendarIdUrl ?? 'https://calendar.google.com/calendar/u/0/r/settings'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Open Google Calendar settings
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                        <li>
                          <span className="text-foreground">Share your calendar</span> with this service account:
                          {calendarSetup?.serviceAccountEmail ? (
                            <div className="mt-2 flex items-center gap-2">
                              <code className="px-2 py-1 rounded bg-muted text-foreground text-xs break-all">
                                {calendarSetup.serviceAccountEmail}
                              </code>
                              <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(calendarSetup.serviceAccountEmail!)}
                                className="text-xs text-primary hover:underline"
                              >
                                Copy
                              </button>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs">Service account email not found. Set CALENDAR_SERVICE_ACCOUNT_EMAIL in env or deploy with creds.json.</p>
                          )}
                          <a
                            href={calendarSetup?.shareCalendarUrl ?? 'https://calendar.google.com/calendar/u/0/r/settings/addbyemail'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1 mt-2"
                          >
                            Add by email in Google Calendar
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      </ol>
                      <p className="text-xs pt-2">After sharing, paste your Calendar ID above and save.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Business Type */}
              <div className="mb-6">
                <label htmlFor="businessType" className="block text-sm font-medium text-foreground mb-2">
                  Business Type
                </label>
                <select
                  id="businessType"
                  value={config.businessType ?? 'general'}
                  onChange={(e) => handleBusinessTypeChange(e.target.value)}
                  className="w-full px-4 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                >
                  {BUSINESS_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sets default info gathering. Custom lets you choose manually below.
                </p>
              </div>

              {/* Appointment Details */}
              <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
                <h3 className="text-sm font-semibold text-foreground mb-3">Appointment Details</h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="serviceTypes" className="block text-sm font-medium text-foreground mb-1">
                      Service types (comma-separated)
                    </label>
                    <input
                      id="serviceTypes"
                      type="text"
                      value={(config.appointmentDetails?.serviceTypes ?? []).join(', ')}
                      onChange={(e) => setAppointmentDetails({
                        serviceTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder="e.g. General consultation, VIP table, AC repair"
                      className="w-full px-4 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="defaultDuration" className="block text-sm font-medium text-foreground mb-1">
                      Default duration (minutes)
                    </label>
                    <input
                      id="defaultDuration"
                      type="number"
                      min={5}
                      max={480}
                      value={config.appointmentDetails?.defaultDurationMinutes ?? 30}
                      onChange={(e) => setAppointmentDetails({
                        defaultDurationMinutes: parseInt(e.target.value, 10) || 30
                      })}
                      className="w-full px-4 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="bookingRules" className="block text-sm font-medium text-foreground mb-1">
                      Booking rules (optional)
                    </label>
                    <textarea
                      id="bookingRules"
                      value={config.appointmentDetails?.bookingRules ?? ''}
                      onChange={(e) => setAppointmentDetails({ bookingRules: e.target.value })}
                      placeholder="e.g. No same-day booking. Minimum 24h notice."
                      rows={2}
                      className="w-full px-4 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Bot Tone */}
              <div className="mb-6">
                <label htmlFor="tone" className="block text-sm font-medium text-foreground mb-2">
                  Bot Tone
                </label>
                <select
                  id="tone"
                  value={config.tone}
                  onChange={(e) => setConfig(prev => ({ ...prev, tone: e.target.value as BotConfig['tone'] }))}
                  className="w-full px-4 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                >
                  {TONE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Knowledge */}
              <div className="mb-6">
                <label htmlFor="customKnowledge" className="block text-sm font-medium text-foreground mb-2">
                  Custom Knowledge & Rules
                </label>
                <textarea
                  id="customKnowledge"
                  value={config.customKnowledge}
                  onChange={(e) => setConfig(prev => ({ ...prev, customKnowledge: e.target.value }))}
                  placeholder="Add specific FAQs, business rules, or knowledge the bot should know..."
                  rows={6}
                  className="w-full px-4 py-2 border border-white/10 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition resize-none"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  This will be injected into the system prompt. Use this for business-specific information.
                </p>
              </div>

              {/* Required Lead Info */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-2">
                  Required Lead Information
                </label>
                <div className="space-y-2">
                  {LEAD_INFO_OPTIONS.map(option => (
                    <label key={option} className="flex items-center gap-3 p-3 border border-white/10 rounded-lg hover:bg-white/5 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={config.requiredLeadInfo.includes(option)}
                        onChange={() => handleLeadInfoToggle(option)}
                        className="w-4 h-4 text-primary border-white/10 rounded focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={saveConfig}
                disabled={saving || !config.businessName.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {hasExistingSetup ? 'Save changes' : 'Save configuration'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="lg:sticky lg:top-8 h-fit">
            <div className="bg-card rounded-lg border border-white/10 shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">System Prompt Preview</h2>
              </div>
              <div className="bg-background rounded-lg p-4 border border-white/10">
                <pre className="text-xs text-foreground font-mono whitespace-pre-wrap overflow-auto max-h-[600px]">
                  {promptPreview || 'Start configuring your bot to see the preview...'}
                </pre>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                This is the exact prompt that will be sent to the AI model during phone calls.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
