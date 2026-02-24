# Call Issues - Quick Fix Guide

## What Actually Worked ✅
- ✅ **Lead saved** (id: `edd7b17a-2a78-4095-b8e6-5cf60d6ecce0`) - Timmy's info is in the database
- ✅ **Email sent** successfully to codedbytyler@gmail.com
- ✅ **Call flow worked** - bot collected name (Timmy) and callback time (noon)

## Issues Found 🔴

### 1. Call-ended logging not working (table empty)
**Why:** Phone server wasn't restarted after adding logging code.

**Fix:**
1. Run the migration: Copy/paste `receptionist/dashboard/call_ended_logs_migration.sql` into Supabase SQL Editor → Run
2. **Restart your phone server** (stop and start it again) so it loads the new `logCallEnded` functions
3. Make another test call - you should see entries in `call_ended_logs` table

### 2. Calendar JWT Error: `invalid_grant: Invalid JWT Signature`
**Why:** Google service account credentials (`creds.json`) are invalid/expired.

**Fix:**
1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Find `receptionist-bot@project-09be10fc-b231-4f89-b99.iam.gserviceaccount.com`
3. Click it → Keys tab → **Delete the old key** (if it exists)
4. **Create new key** → JSON → Download
5. Replace `receptionist/creds.json` with the new JSON file
6. Restart phone server

**Note:** The service account needs access to the calendar (`codedbytyler@gmail.com`). Make sure the calendar is shared with that service account email.

### 3. SMS Undelivered
**Why:** Most likely A2P 10DLC campaign not approved yet, or carrier blocking.

**What happened:**
- SMS was **sent** successfully (`message.sid=SM6c7fb72a7e1f5a68ed666b762b2143fb`)
- But Twilio reports **undelivered** (carrier rejected it)

**Fix:**
1. Check Twilio Console → Messaging → Regulatory Compliance → Campaigns
2. See if your campaign status is "Pending" or "Rejected"
3. If pending: Wait for approval (can take 1-3 days)
4. If rejected: Check the rejection reason and fix it
5. **Alternative:** For testing, you can use Twilio's test credentials or a verified sender (but production needs A2P approval)

**Number format is correct:** `7146550688` → `+17146550688` ✅

---

## Quick Actions
1. ✅ Run migration SQL
2. ✅ Restart phone server
3. ✅ Fix Google Calendar creds (regenerate service account key)
4. ⏳ Wait for A2P campaign approval (or use test mode for now)

---

## Test After Fixes
Make another test call and check:
- `call_ended_logs` table has an entry
- Calendar check works (no JWT error)
- SMS might still fail until A2P is approved (that's expected)
