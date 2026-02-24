# Tomorrow's todo (don't forget)

## Priority order

### 1. Reliability first (make sure it doesn't break)
- [x] **Call-ended reliability check** – Verify status callback fires every time; add simple "last call / last error" view in dashboard so you know if leads/emails are being dropped. ✅ **DONE** - Dashboard shows last call status, logs to `call_ended_logs` table, handles both `/call-ended` and `/voice` status updates.
- [x] **Bot resilience** – Add retries/fallbacks so one Supabase/API blip doesn't kill the call. ✅ Retries on getBotConfig, upsertSession, OpenRouter API; fallback to env BUSINESS_NAME when config fails.
- [x] **First greeting check** – Confirm bot says business name clearly right away. ✅ Greeting now: "You've reached [Business Name]. Thank you for calling. How can I assist you today?"

### 2. Legal/consent (for A2P compliance)
- [ ] **Signup for message sending** – Create one clear opt-in path (form or "text this number to get alerts") so you have proof of consent for A2P messaging.
- [ ] **Terms + privacy as "second route"** – Wire terms/privacy links into signup/opt-in flow ("By signing up, you agree to Terms and Privacy Policy") so consent is explicit and documented.

### 3. Business-specific features (the fun stuff)
- [ ] **Appointment specifics** – Iron out what kind of appointments the bot makes and how (service types, duration, booking rules, etc.).
- [ ] **Business-type info gathering** – Tune what the bot asks for and collects based on business type (e.g. HVAC needs different info than strip club vs general service).

### 4. Quality-of-life polish
- [x] **Quick call status view** – Simple way to see "did the last call get a lead/email?" so you're not guessing if things worked. ✅ **DONE** - "Last Call Status" section in dashboard shows lead saved, email sent, SMS sent, and any errors.

---
*Add/check off as you go. You got this.*
