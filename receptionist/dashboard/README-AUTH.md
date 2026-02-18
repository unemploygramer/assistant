# Dashboard auth setup

The dashboard has **login and signup**. Each user gets their own business profile.

## Auth system overview (routes & protection)

- **Public routes**: `/`, `/login`, `/signup`. No auth required.
- **Protected routes**: `/dashboard/*`. Middleware runs first: if there is no Supabase session (cookie), the user is redirected to `/login?next=<requested path>`. After login they are sent back to that path (or `/dashboard/config`).
- **Middleware** uses `@supabase/ssr` `createServerClient` with `get`/`set`/`getAll`/`setAll` so the session is read from and written to cookies. Redirect responses forward any refreshed session cookies.
- **Server** (layout, API routes) uses `createClient()` from `lib/supabase/server.ts`, which uses Next `cookies()` with the same `get`/`set`/`getAll`/`setAll`/`remove` so Server Components and API routes see the same session.
- **API** `/api/config`: GET and POST both call `supabase.auth.getUser()`. If there is no user, they return 401. All reads/writes are scoped by `user_id` from that user.
- **Login**: `next` query param is validated (must be same-origin path, e.g. `/dashboard/config`). No open redirects. Short delay after sign-in before full-page redirect so cookies are written.
- **Logout**: `signOut()` then full-page navigation to `/` so the next request has no session cookie.
- **No redirect in dashboard layout**: The layout does not call `redirect('/login')`; only middleware protects. That avoids redirect loops between layout and middleware.

## 1. Enable Auth in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **Providers**.
3. Enable **Email** (and optionally **Confirm email** if you want verification).

## 2. Env vars

In `dashboard/.env.local` add (same values as your existing Supabase vars):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The browser needs `NEXT_PUBLIC_*` to talk to Supabase from the login/signup pages.

## 3. Run the app

```bash
cd receptionist/dashboard
npm run dev
```

Open http://localhost:3000 → **Sign up** (business name + email + password) → you're taken to **Bot Configuration**. Save to create your business profile. Only you see that profile.

## 4. Linking your account to an existing profile (user_id disconnect)

The dashboard **only loads the row** in `business_profiles` where `user_id` = your logged-in user's ID. If your existing rows have `user_id = NULL`, the API finds no profile and the form stays empty.

**Quick fix — claim one existing row:**

1. Supabase → **Authentication** → **Users** → copy your user's **UUID** (e.g. `71487673-bf7d-4473-8b2d-d832c158a0d0`).
2. **Table Editor** → `business_profiles` → open the row you want (e.g. the one with your Twilio number and calendar).
3. Set that row's **`user_id`** to the UUID you copied. Save.
4. Reload the dashboard config page — that profile will load and the form will show the existing business name, Twilio number, calendar ID, etc.

After that, saving from the dashboard updates that same row. The phone server still looks up by `twilio_phone_number`, so nothing else needs to change.

## 5. Optional: RLS

To restrict the database so users can only read/write their own rows, run `auth-rls-optional.sql` in the Supabase SQL Editor. Do this after profiles are linked to users (e.g. after step 4 if you care about existing data).
