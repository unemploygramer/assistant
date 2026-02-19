# SMS lead alerts — setup and testing

## 1. Add the DB column (one-time)

In **Supabase** → **SQL Editor**, run:

```sql
ALTER TABLE public.business_profiles
ADD COLUMN IF NOT EXISTS owner_phone text;
```

Or run the file `dashboard/owner_phone_migration.sql`.

## 2. Set your phone in the dashboard

- Open **Dashboard** → **Config**.
- Fill **Your phone (SMS lead alerts)** with your number in E.164 (e.g. `+17145551234`).
- Save.

That value is stored in `business_profiles.owner_phone` and used as the SMS “to” when a lead is saved.

## 3. Env (phone server .env in Baddie Assistant root)

- `USE_TWILIO_SMS=true` — turn on sending SMS via Twilio (otherwise we only log to DB).
- Optional fallbacks if you don’t use Config:
  - `MY_CELL_NUMBER=+1...` — used if no `owner_phone` in the profile.
  - `TWILIO_PHONE_NUMBER=+1...` — used as SMS “from” if the profile has no Twilio number.

SMS “from” is the **Twilio number** (your business line from Config, or `TWILIO_PHONE_NUMBER`). Twilio will only send if that number is SMS-capable and you have balance/credit.

## 4. How to test

1. **Restart the phone server** so it picks up env and code. Watch startup logs for the SMS line.
2. **Trigger a full call flow**: call your Twilio number, have a short convo, hang up. When the call ends we run `processCallCompletion` → `logNotificationWithSMS`.
3. **Watch server logs** (console “out da ass”):
   - `[CALL-COMPLETE] getBotConfig result:` — should show `owner_phone` and `twilio_phone_number`.
   - `[CALL-COMPLETE] Sending notifications. SMS options:` — shows what we’re passing.
   - `[NOTIFY] ========== logNotificationWithSMS` — full notify block.
   - `SMS resolved: to=..., from=...` — numbers we’re using.
   - `About to call Twilio messages.create` — right before send.
   - Either `Twilio SMS sent successfully. message.sid=...` or `Twilio SMS send failed:` with code/status/moreInfo.

4. **If SMS doesn’t send**:
   - Logs say “No SMS to number” → set **Your phone** in Config (or `MY_CELL_NUMBER` in .env).
   - Logs say “No SMS from number” → set **Twilio number** in Config (or `TWILIO_PHONE_NUMBER` in .env).
   - Twilio error 21608 / “not SMS capable” → that Twilio number can’t send SMS; use another number or enable SMS in Twilio.
   - Twilio error 21211 / “invalid to” → “to” number is invalid; use E.164 (e.g. `+17145551234`).
   - Other Twilio errors → check code/status/moreInfo in the logs; Twilio docs for that code.

## 5. Quick checklist

- [ ] Ran migration (owner_phone on business_profiles).
- [ ] Config → Your phone (SMS lead alerts) saved.
- [ ] Config → Twilio number set (same as the number that receives calls).
- [ ] .env: `USE_TWILIO_SMS=true`.
- [ ] Restarted phone server, did a test call, checked logs for `[NOTIFY]` and Twilio result.
