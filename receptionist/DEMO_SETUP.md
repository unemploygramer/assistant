# Demo mode (no third number)

## How it works

1. Prospect goes to **/demo** and enters their phone number.
2. They click **Call me** → your server starts an **outbound** call from your demo line to their number.
3. When they answer, Twilio hits your existing **/voice** webhook → same AI, same greeting.
4. They hear: "You've reached [Your Demo Business Name]. Thank you for calling. How can I assist you today?"

## Setup (one time)

### 1. Pick your demo line

Use **one of your two existing numbers** as the demo line (no third number).

### 2. Env (root `.env`)

```bash
# Which number to use when triggering "Call me" demos (must be assigned to a business profile)
DEMO_LINE=+15153053199
```

If you don't set `DEMO_LINE`, it falls back to `TWILIO_PHONE_NUMBER`.

### 3. Demo business profile

- In the dashboard: create (or use) a business profile and **claim** that same number (the one in `DEMO_LINE`).
- Set the **business name** to whatever you want prospects to hear, e.g. "Baddie Demo" or "Acme HVAC".
- For a specific pitch: change the business name to their brand (e.g. "Joe's Bar") before the demo so the AI says "You've reached Joe's Bar."

### 4. Dashboard → phone server (deployed)

If the dashboard is on Vercel and the phone server is at `voicemail.snaptabapp.com`, set in Vercel (or `.env.local` for the dashboard):

```bash
PHONE_SERVER_URL=https://voicemail.snaptabapp.com
```

Default is `https://voicemail.snaptabapp.com` if unset.

## Routes

- **Landing:** Home has "Try demo — we call you" → `/demo`.
- **Demo page:** `/demo` — form with phone number, "Call me" button.
- **API:** `POST /api/trigger-demo` (dashboard) → proxies to phone server `POST /trigger-demo`.
- **Phone server:** `POST /trigger-demo` — body `{ customerNumber }`, creates outbound call from `DEMO_LINE` to that number, `url` = your `/voice` webhook.

## Twilio Dev Phone (optional)

To test without using your personal cell:

```bash
twilio plugins:install @twilio-labs/plugin-dev-phone
twilio dev-phone
```

Use the browser phone to call your demo number or to receive the outbound demo call (call your own number from the dev phone).
