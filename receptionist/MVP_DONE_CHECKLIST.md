# MVP Done — Ship and Stop

**Goal:** Finish this one thing. Not "perfect." Not "every feature." **Done.**

---

## You already have

- ✅ Sign up / login
- ✅ Config: business name, tone, Twilio number, calendar, appointment details
- ✅ Claim a number from pool
- ✅ Phone server: answers calls, collects leads, saves to DB
- ✅ Leads page: see leads, view transcript, update status
- ✅ Command Center: ROI stats, calendar view, lead feed
- ✅ Stripe: checkout, success, subscription status on config
- ✅ Demo: call a number or talk in browser (when phone server is running)
- ✅ Terms, privacy, contact, SMS opt-in

**That’s an MVP.** Someone can sign up, set up, get a number, receive calls, see leads, and pay.

---

## "Done" = this checklist (then stop)

Do these in order. When the list is checked, **you’re done.** No "one more thing."

### 1. Supabase migrations (one-time)

In Supabase → SQL Editor, run (if you haven’t already):

- `receptionist/dashboard/user-leads-view.sql`
- `receptionist/dashboard/bookings_migration.sql`
- `receptionist/dashboard/call_ended_logs_migration.sql` (if you use last-call status)

No errors = good.

### 2. One smoke test

- Sign up (or log in) → Dashboard → Config.
- Set business name, save.
- Open Leads: should load (empty or with data).
- Open Demo: page loads, demo number shows.
- If you have a Twilio number: call it, leave a message, confirm a lead appears in Leads.

If that works, core flow is good.

### 3. Deploy so it’s live

- **Dashboard:** Vercel (or similar) from `receptionist/dashboard`, env from `.env.local`.
- **Phone server:** Railway / Render / your current host (e.g. `receptionist/` + `phone_server.js`), with tunnel or public URL.
- Set **PHONE_SERVER_URL** in dashboard env to the public phone server URL (e.g. `https://voicemail.snaptabapp.com`).

So: real URL for the app, real URL for the phone server, dashboard points at that server.

### 4. Landing page = one CTA

- Home: one clear action. e.g. **"Start free trial"** or **"Get your number — $79/mo"** → signup or demo.
- No redesign. Just one button and a short line (e.g. "AI receptionist. Never miss a lead.").

### 5. Stop adding features

- No new pages, no "quick" extras.
- Bugs that block signup or payment: fix.
- Everything else: write down in "v2" and ignore until you have paying users.

---

## What you’re NOT doing for MVP

- Stripe webhooks (you can add later when someone cancels)
- "Call Back" button
- Writing to internal `bookings` from the phone (optional)
- Twilio signature verification (hardening, not launch)
- RLS (hardening, not launch)
- More onboarding steps
- More demo features

**Ship with what you have.** Fix only what’s broken for signup → config → call → lead → pay.

---

## When the checklist is done

You have:

- A live app.
- A clear "try it / sign up / pay" path.
- No obligation to keep building until you choose to.

**That’s the win.** Ship it. Then step off the treadmill.
