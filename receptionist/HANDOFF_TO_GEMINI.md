# Handoff to Gemini — Baddie Assistant / AI Receptionist

**Hi Gemini.**

This document explains every route, page, and how the system works. Use it to get up to speed and build on this codebase.

---

## What This Project Is

- **AI phone receptionist:** Twilio → Express server → OpenRouter LLM + ElevenLabs TTS. Answers calls, collects leads, checks/books Google Calendar per business.
- **Multi-tenant:** Each Twilio number maps to a business profile in Supabase. Dashboard (Next.js) lets users configure business name, tone, calendar, etc.
- **Monetization:** $79/mo Stripe subscription. Demo mode for prospects to try before buying.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DASHBOARD (Next.js)                                 │
│  receptionist/dashboard/  —  Port 3000 (or Vercel)                           │
│  Auth: Supabase (cookies). Data: business_profiles, leads, bookings by user  │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ API calls (same-origin or PHONE_SERVER_URL)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PHONE SERVER (Express)                             │
│  receptionist/phone_server.js  —  Port 3001                                  │
│  Twilio webhooks: /voice, /gather, /call-ended, /trigger-demo, /sms-status   │
│  Lookup: business_profiles by twilio_phone_number                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ Supabase (anon key)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE                                            │
│  business_profiles, leads, sessions, twilio_numbers, call_ended_logs,          │
│  bookings, sms_opt_ins, user_leads (view)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Critical link:** Phone server looks up by `twilio_phone_number`. Dashboard looks up by `user_id`. One `business_profiles` row has both — same row serves phone routing and dashboard.

---

## Dashboard Routes (Next.js App Router)

### Pages (UI)

| Route | File | Auth | Description |
|-------|------|------|-------------|
| `/` | `app/page.tsx` | No | Home. Redirects to `/dashboard` if logged in. Otherwise: Try demo, Log in, Sign up. |
| `/login` | `app/login/page.tsx` | No | Supabase email login. Redirects to `/dashboard` when logged in. |
| `/signup` | `app/signup/page.tsx` | No | Supabase email signup. |
| `/demo` | `app/demo/page.tsx` | No | Demo page. Shows demo number (from DB or env). "Call (XXX) XXX-XXXX to test." |
| `/dashboard` | `app/dashboard/page.tsx` | Yes | Command Center: ROI header, Your Bookings calendar, Lead Feed sidebar. |
| `/dashboard/config` | `app/dashboard/config/page.tsx` | Yes | Business config: name, tone, Twilio number, calendar ID, appointment details, claim number, subscription. |
| `/dashboard/leads` | `app/dashboard/leads/page.tsx` | Yes | Leads list (table/cards). View transcript, update status. |
| `/dashboard/checkout/success` | `app/dashboard/checkout/success/page.tsx` | Yes | Stripe success. Calls `/api/checkout-success`, redirects to `/dashboard`. |
| `/about` | `app/about/page.tsx` | No | Marketing/about page. |
| `/contact` | `app/contact/page.tsx` | No | Contact form. POSTs to `/api/contact`. |
| `/opt-in` | `app/opt-in/page.tsx` | No | SMS opt-in form. POSTs to `/api/opt-in`. |
| `/terms` | `app/terms/page.tsx` | No | Terms and conditions. |
| `/privacy` | `app/privacy/page.tsx` | No | Privacy policy. |

### API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/config` | GET | Yes | Load business profile for `user_id`. Returns config, twilio_phone_number, calendar_id, owner_phone, subscription_status. |
| `/api/config` | POST | Yes | Save config. Creates or updates `business_profiles` for `user_id`. |
| `/api/me` | GET | No | Returns `{ user: { id, email } \| null }`. Used for nav/auth state. |
| `/api/leads` | GET | Yes | Fetch leads via `user_leads` view (joins leads + business_profiles by user_id). |
| `/api/leads` | PATCH | Yes | Update lead status. Verifies ownership via `user_leads`. |
| `/api/bookings` | GET | Yes | Fetch bookings for user's business. Returns `[]` if table missing. |
| `/api/dashboard-stats` | GET | Yes | Returns totalLeads, appointmentsSet, pipelineValue (leads × $250). Uses `user_leads` and `bookings`. |
| `/api/last-call` | GET | Yes | Last call-ended log for user's Twilio number (from `call_ended_logs`). |
| `/api/claim-number` | POST | Yes | Claim a number from `twilio_numbers` pool (status=available). Assigns to user's business. |
| `/api/calendar-setup` | GET | Yes | Returns serviceAccountEmail (from creds.json or env), getCalendarIdUrl, shareCalendarUrl for "Link Calendar" instructions. |
| `/api/demo-number` | GET | No | Demo line from `twilio_numbers` (is_demo=true) or env DEMO_LINE. Returns `{ number, display }`. |
| `/api/trigger-demo` | POST | No | Proxies to phone server `/trigger-demo`. Body: `{ customerNumber }`. Starts outbound call from demo line to customer. |
| `/api/create-checkout-session` | POST | Yes | Creates Stripe Checkout session. Redirects to Stripe; success_url includes session_id. |
| `/api/checkout-success` | GET | Yes | Query: `session_id`. Retrieves Stripe session, creates or updates `business_profiles` with subscription_status, stripe_customer_id, stripe_subscription_id. |
| `/api/opt-in` | POST | No | SMS opt-in. Upserts `sms_opt_ins` with phone, consent_source, consented_at. |
| `/api/contact` | POST | No | Contact form. Sends email via nodemailer to CONTACT_EMAIL_TO. |

---

## Phone Server Routes (Express)

| Route | Method | Called By | Description |
|-------|--------|-----------|-------------|
| `/voice` | POST | Twilio (incoming or outbound) | Initial greeting. Lookup business by `To` (incoming) or `From` (outbound demo). Play greeting via ElevenLabs or Twilio TTS. Redirect to `/gather` for speech. If call status = completed/canceled/etc., handles as call-ended. |
| `/gather` | POST | Twilio (after speech) | STT result → OpenRouter LLM (with tools: check_availability, book_appointment, end_call) → ElevenLabs TTS → TwiML. Saves transcript to `sessions`. Loops until end_call. |
| `/call-ended` | POST | Twilio (status callback) | Call finished. Logs to `call_ended_logs`. Runs `processCallCompletion`: fetch session, generate summary, save lead, send email/SMS, delete session. |
| `/trigger-demo` | POST | Dashboard `/api/trigger-demo` | Creates outbound call from DEMO_LINE to customerNumber. Twilio connects to `/voice` when customer answers. |
| `/sms-status` | POST | Twilio | SMS delivery status callback. Logs failures. |
| `/health` | GET | - | Health check. |
| `/test` | GET | - | Simple test response. |
| `/test-voice` | GET | - | Returns TwiML for testing. |
| `/test-email` | GET | - | Sends test email. |

---

## Data Flow (Key Paths)

### 1. Incoming Call

1. Twilio → `POST /voice` (body: CallSid, From, To, Direction, CallStatus…)
2. `To` = business Twilio number → `getBotConfig(twilioPhoneNumber)` from `business_profiles`
3. Greeting + `<Gather>` → Twilio records speech
4. Twilio → `POST /gather` with SpeechResult
5. LLM runs (tools: check_availability, book_appointment, end_call)
6. Calendar tools use `calendar_id` / `google_calendar_id` from profile
7. Loop until end_call or user hangs up
8. Twilio → `POST /call-ended` (status callback)
9. `processCallCompletion`: session → summary → save lead (with `from_number` = business line) → email/SMS → delete session

### 2. Demo Call (Outbound)

1. User on `/demo` enters phone → Dashboard `POST /api/trigger-demo` → Phone server `POST /trigger-demo`
2. Phone server creates Twilio outbound call: From = DEMO_LINE, To = customer
3. Customer answers → Twilio → `POST /voice` with Direction=outbound-api
4. `From` = demo line → `businessLineNumber = From`; Demo Mode: Baddie Demo Corp., simulated calendar
5. Same flow as incoming: `/gather` loop, `/call-ended` when done
6. Lead saved with `is_demo = true`; email goes to BUSINESS_OWNER_EMAIL

### 3. Dashboard Config Load

1. User logs in → middleware redirects `/dashboard` if not logged in
2. Config page fetches `GET /api/config`
3. API: `supabase.auth.getUser()` → `business_profiles` where `user_id = user.id`
4. Returns config, twilio_phone_number, calendar_id, owner_phone, subscription_status
5. SyncStatus: fetches `/api/config` and `/api/demo-number`; shows "your line" or "demo" + number

### 4. Leads in Dashboard

1. `user_leads` view: `leads` JOIN `business_profiles` ON `leads.from_number = business_profiles.twilio_phone_number`
2. Filter: `business_profiles.user_id IS NOT NULL`
3. Dashboard `GET /api/leads` → `user_leads` where `user_id = user.id`
4. Same view used for `dashboard-stats` totalLeads count

### 5. Bookings (Paper Trading)

1. `bookings` table: business_id, lead_id, customer_name, customer_phone, start_time, service_type, status
2. `GET /api/bookings` → user's business_profiles.id → bookings where business_id = that id
3. **Note:** Phone server currently writes to Google Calendar, not `bookings`. To sync: add logic in `book_appointment` tool to also insert into `bookings`.

---

## Database Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `business_profiles` | One per user (or created on checkout). user_id, business_name, bot_config (JSON), twilio_phone_number, calendar_id, owner_phone, subscription_status, stripe_*. |
| `leads` | One per call. phone, transcript, summary (JSON), status, from_number (business line for ownership), is_demo. |
| `user_leads` | View: leads JOIN business_profiles. Adds user_id for dashboard filtering. |
| `sessions` | Call state. call_sid, transcript_buffer (messages), metadata. Deleted after call ends. |
| `call_ended_logs` | Log when /call-ended fires. call_sid, status, twilio_to_number, twilio_from_number, lead_id, email_sent, sms_sent. |
| `twilio_numbers` | Pool. phone_number, status (available/assigned), business_profile_id, is_demo. |
| `bookings` | Paper-trading appointments. business_id, lead_id, customer_*, start_time, service_type, status. |
| `sms_opt_ins` | SMS consent. phone, consent_source, consented_at. |
| `notifications` | Email/SMS send log. |

---

## Env Variables

**Root `.env` (phone server, calendar):**
- SUPABASE_URL, SUPABASE_ANON_KEY
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
- OPENROUTER_KEY (or OPENROUTER_API_KEY)
- ELEVENLABS_API_KEY
- PUBLIC_URL (e.g. https://voicemail.snaptabapp.com)
- DEMO_LINE (demo Twilio number)
- BUSINESS_OWNER_EMAIL (demo lead emails)
- CALENDAR_ID (fallback)
- GOOGLE_APPLICATION_CREDENTIALS or creds.json in receptionist/

**Dashboard `.env.local`:**
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
- PHONE_SERVER_URL (for trigger-demo proxy)
- STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID (or STRIPE_PRICE_ID_MONTHLY)
- NEXT_PUBLIC_APP_URL
- CONTACT_EMAIL_TO, CONTACT_EMAIL_APP_PASSWORD
- CALENDAR_SERVICE_ACCOUNT_EMAIL (optional; for calendar-setup API when creds.json not available)

---

## Middleware (Auth)

- `/dashboard/*` → redirect to `/login` if no user
- `/login`, `/signup` → redirect to `/dashboard` if user exists
- Uses Supabase SSR client with cookies (getAll, setAll, get, set, remove)

---

## Components (Dashboard)

- **Nav** — Header with Baddie Assistant, Command Center, auth links
- **ROIHeader** — Total Leads, Appointments Set, Pipeline Value (from `/api/dashboard-stats`)
- **PaperCalendar** — Your Bookings (real) + collapsible Example preview (sample)
- **LeadFeed** — Sidebar with latest leads; high-urgency styling; Call Back, View Transcript
- **SyncStatus** — "Bot Active / Listening on your line: (XXX) XXX-XXXX" or "demo: ..."

---

## Migrations to Run (Supabase SQL Editor)

1. `dashboard/bookings_migration.sql` — bookings table
2. `dashboard/user-leads-view.sql` — user_leads view
3. `dashboard/call_ended_logs_migration.sql` — call_ended_logs (if not exists)
4. Product launch: twilio_numbers.is_demo, leads.is_demo, business_profiles.subscription_status, stripe_*

---

## What's Not Done / Gaps

1. **Bookings from phone:** `book_appointment` tool writes to Google Calendar only. Add insert into `bookings` when bot books.
2. **Stripe webhooks:** subscription_status not updated on cancel/past_due. Add webhook handler.
3. **Call Back button:** Lead Feed "Call Back" doesn't initiate call yet.
4. **Twilio webhook validation:** Phone server doesn't verify Twilio signature.
5. **RLS:** business_profiles RLS optional; consider enabling.

---

## Quick Reference

| Need to… | Look at |
|----------|---------|
| Change bot behavior | `lib/prompt-builder.js`, phone_server.js CALENDAR_TOOLS |
| Add dashboard page | `app/dashboard/…/page.tsx` |
| Add API route | `app/api/…/route.ts` |
| Change auth flow | `middleware.ts`, Supabase Auth |
| Change phone flow | `phone_server.js` /voice, /gather, processCallCompletion |
| Calendar integration | `calendar.js`, `services/calendarService.js`, config calendar_id |

---

— Cursor AI (handoff for Gemini)
