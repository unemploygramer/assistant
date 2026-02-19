# Baddie Assistant / AI Receptionist — Project Brief for Gemini

**Context:** This is a handoff doc so Gemini (or another dev/AI) can get up to speed. It reflects where we are as of this session and one perspective on what to do next.

---

## What this project is

- **AI phone receptionist** that answers Twilio calls, talks via voice (STT → LLM → TTS), collects leads, and can check/book Google Calendar per business.
- **Multi-tenant:** Multiple Twilio numbers (e.g. “toms”, “New Business”). Each number maps to a **business profile** in Supabase. Identity, prompt, and calendar come from that profile.
- **Dashboard:** Next.js app (login/signup via Supabase Auth) where users manage **their** business config: business name, tone, custom knowledge, required lead fields, Twilio number (E.164), Google Calendar ID. Data lives in `business_profiles`; the row is tied to the user via `user_id`.

---

## Stack (high level)

| Layer | Tech |
|-------|------|
| Phone / voice | Twilio (voice webhooks), Express server (`receptionist/phone_server.js`) |
| AI | OpenRouter (OpenAI-compatible API), system prompt from `lib/prompt-builder.js` |
| TTS | ElevenLabs (streaming or fallback) |
| DB / auth | Supabase: `business_profiles`, `leads`, `sessions`, `notifications`; Auth for dashboard |
| Calendar | Google Calendar API via service account; `receptionist/calendar.js` + `services/calendarService.js` |
| Dashboard | Next.js 14 (App Router), Supabase SSR (middleware + server client for cookies) |
| Tunnel | Cloudflare Tunnel (e.g. `voicemail.snaptabapp.com`) for Twilio webhooks |

---

## Where things are at

**Phone flow (working):**

- Incoming call hits `/voice` → lookup by `req.body.To` (Twilio number) → `getBotConfig(twilioPhoneNumber)` from Supabase `business_profiles` (by `twilio_phone_number`).
- Greeting uses business name; conversation uses system prompt (tone, custom knowledge, required lead info).
- `/gather` does STT → OpenRouter LLM (with optional tools: check_availability, book_appointment) → ElevenLabs TTS → TwiML back to Twilio.
- Transcripts and session state go to Supabase `sessions`; leads to `leads`; calendar tools use `calendar_id` / `google_calendar_id` from the same profile.

**Dashboard (working after recent fixes):**

- **Auth:** Login/signup (Supabase Email). Middleware protects `/dashboard/*` and reads session via cookies (`get`/`set`/`getAll`/`setAll` so the server actually sees the session). No redirect in the dashboard layout (avoids redirect loops).
- **Config page:** GET `/api/config` loads the profile where `business_profiles.user_id` = logged-in user; form shows business name, Twilio number, calendar ID, tone, custom knowledge, lead checkboxes. Save = POST to create or update that profile.
- **Critical link:** A row in `business_profiles` only shows up in the dashboard if its `user_id` matches the logged-in user. Existing rows created before auth had `user_id = NULL`; we fixed the “empty form” by having the user set `user_id` on the desired row in Supabase Table Editor (documented in `dashboard/README-AUTH.md`).

**Important gotcha:**

- Phone server looks up profile by **`twilio_phone_number`**.
- Dashboard looks up profile by **`user_id`**.
- So one row can serve both: same row has `user_id` (for dashboard) and `twilio_phone_number` (for phone routing). Linking is done by setting `user_id` on the right row.

---

## Key paths (for context)

- **Phone server:** `receptionist/phone_server.js`, `receptionist/lib/db.js` (`getBotConfig`), `receptionist/lib/prompt-builder.js`, `receptionist/services/calendarService.js`, `receptionist/calendar.js`
- **Dashboard:** `receptionist/dashboard/` (Next App Router), `receptionist/dashboard/middleware.ts`, `receptionist/dashboard/app/dashboard/config/page.tsx`, `receptionist/dashboard/app/api/config/route.ts`
- **Env:** Root `.env` for phone server + Supabase + Twilio + OpenRouter + ElevenLabs; `receptionist/dashboard/.env.local` for Next.js Supabase public vars.

---

## Two cents: what’s solid and what to do next

**What’s solid:**

- Multi-tenant by Twilio number is clear; one codebase, many businesses.
- Supabase for profiles + auth + sessions/leads keeps everything in one place.
- Dashboard auth is in a good place: middleware + cookie-based session, no layout redirect, config load/save and “current state” UX (including the note when no profile is linked).
- Calendar tools (check + book) are wired; prompt and config are shared between dashboard preview and phone server.

**What’s fragile or worth tightening:**

1. **Single profile per user:** The API assumes one active profile per `user_id`. If you ever need multiple businesses per user, you’d add something like “current business” or a profile picker and scope by both `user_id` and profile id.
2. **Console logs:** We added `[CONFIG]` and `[API config GET]` logs for debugging. Safe to remove or gate behind a dev flag before calling it “production.”
3. **RLS:** `business_profiles` RLS is optional (see `dashboard/auth-rls-optional.sql`). Turning it on and scoping by `auth.uid()` would harden things so the anon key can’t touch other users’ rows even if the app code misbehaves.
4. **Signup → profile:** Signup doesn’t create a `business_profiles` row; the first Save on the config page does. That’s fine, but you could create an empty profile on signup (with just `user_id`) so “current setup” is never “no profile” for a brand-new user.
5. **Phone server auth:** The phone server uses Supabase anon key and `getBotConfig(twilio_phone_number)` only. It doesn’t verify that the incoming webhook is from Twilio (e.g. Twilio request validation). Adding Twilio signature validation is a good security step for production.

**Recommendations:**

- **Short term:** Remove or reduce debug logs on config/API; optionally enable RLS on `business_profiles`; add Twilio webhook signature verification on `/voice` and `/gather`.
- **Next feature level:** If you want “edit what’s already there” to feel even clearer, you could show “Last saved: …” more prominently or add a “Revert to saved” when the form is dirty. The current “Current setup (from Supabase)” block already does the job.
- **Docs:** `dashboard/README-AUTH.md` explains auth and the `user_id` linking; keeping one “start here” doc (this brief or a STATUS.md) that points to that + phone server + env will help the next person (or Gemini) jump in.

---

**Bottom line:** The project is in a good state: phone flow and dashboard are wired, multi-tenant by number, and profile ↔ user linking is understood and documented. The main trip-up was `user_id` being NULL on existing rows; that’s fixed by setting `user_id` in Supabase. Next steps are mostly hardening (logs, RLS, Twilio verification) and small UX/docs polish.
