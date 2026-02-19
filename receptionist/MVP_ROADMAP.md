# MVP Roadmap: AI Receptionist → Revenue

**Goal:** Get paying customers ASAP. One thing at a time.

---

## What you have NOW (working)

✅ **Phone system:** Answers calls, collects leads, saves to Supabase `leads` table  
✅ **Multi-tenant:** Each Twilio number = one business profile  
✅ **Dashboard:** Login/signup, config page (business name, tone, Twilio number, calendar)  
✅ **Calendar:** Can check availability and book appointments  
✅ **Auth:** Secure, cookie-based, middleware-protected  

**Missing for MVP → Revenue:**
- ❌ No way to VIEW leads in dashboard (they're saved but invisible)
- ❌ No billing/payment (Stripe, Paddle, etc.)
- ❌ No usage limits or subscription tiers
- ❌ No onboarding flow (new user → set up → first call)

---

## MVP Path Options (pick ONE to start)

### **Option A: Leads Dashboard First** ⭐ RECOMMENDED
**Why:** Customers need to SEE value immediately. If they can't see the leads coming in, they won't pay.

**What to build:**
1. **Leads page** (`/dashboard/leads`): Table/list of all leads from `leads` table where `from_number` matches their Twilio number (or join via `business_profiles`).
   - Show: phone, transcript, summary, status (new/contacted/converted), created_at
   - Filter by status, date range
   - Click lead → see full transcript + summary
   - Mark as "contacted" or "converted" (update status)

**Time:** 2-4 hours  
**Revenue impact:** HIGH — customers see ROI immediately  
**Next step after:** Add billing (Option B)

---

### **Option B: Billing/Subscription First**
**Why:** Get paid upfront, then deliver value.

**What to build:**
1. **Stripe integration** (or Paddle — simpler, handles taxes):
   - Add Stripe/Paddle to dashboard
   - Subscription tiers: Free (10 calls/month), Starter ($29/mo, 100 calls), Pro ($99/mo, unlimited)
   - Check subscription status on dashboard load
   - Block phone calls if over limit (or show warning)

**Time:** 4-8 hours (Stripe) or 2-4 hours (Paddle)  
**Revenue impact:** IMMEDIATE — can charge right away  
**Risk:** Customers pay but don't see value yet → churn risk

---

### **Option C: Onboarding Flow**
**Why:** Reduce friction, get users to first successful call faster.

**What to build:**
1. **Post-signup wizard:**
   - Step 1: Business name
   - Step 2: Twilio number (or "I'll add later")
   - Step 3: Calendar ID (optional)
   - Step 4: Test call button (calls their number, bot answers)
   - Step 5: "You're all set!" → redirect to dashboard

**Time:** 3-5 hours  
**Revenue impact:** MEDIUM — better conversion, but doesn't directly make money  
**Best paired with:** Option A or B

---

## My Recommendation: **Option A → Option B** (in that order)

**Week 1: Leads Dashboard**
- Build `/dashboard/leads` page
- Show leads from their business (join `leads` + `business_profiles` by Twilio number)
- Add filters, status updates
- **Test with 1-2 real customers** — get feedback, iterate

**Week 2: Billing**
- Add Stripe (or Paddle)
- Free tier: 10 calls/month
- Paid tier: $49/mo unlimited (or $29/100 calls)
- Gate phone calls if over limit
- **Launch pricing page** → start charging

**Why this order:**
1. Customers see value FIRST (leads dashboard) → they're invested
2. THEN you charge → they're more likely to pay because they've seen it work
3. If you charge first and they can't see leads, they cancel

---

## After MVP (future features)

- **Analytics:** Call volume, lead conversion rate, response time
- **SMS notifications:** Auto-text business owner when new lead comes in
- **CRM integration:** Export to HubSpot, Salesforce, etc.
- **Voice customization:** Multiple voices, languages
- **Call recording playback:** Listen to full calls in dashboard
- **A/B testing prompts:** Test different tones, see which converts better

---

## Quick Wins (do these while building MVP)

1. **Remove debug logs** from config page (clean up console)
2. **Add "Last saved" timestamp** more prominently on config page
3. **Add RLS** on `business_profiles` (security hardening)
4. **Twilio webhook verification** (security hardening)
5. **Error boundaries** in dashboard (better error UX)

---

## Revenue Model Ideas

**Option 1: Subscription tiers**
- Free: 10 calls/month
- Starter: $29/mo, 100 calls
- Pro: $99/mo, unlimited

**Option 2: Usage-based**
- $0.50 per call (or $0.10 per minute)
- Minimum $29/mo

**Option 3: Hybrid**
- Base $29/mo + $0.25 per call over 50/month

**My take:** Start with **Option 1 (tiers)** — simpler to explain, predictable revenue. Can add usage-based later.

---

## Next Steps (right now)

1. **Decide:** Option A (leads) or Option B (billing)?
2. **If A:** Build `/dashboard/leads` page (I can help code it)
3. **If B:** Set up Stripe/Paddle account, add to dashboard
4. **Test:** Get 1-2 real users, get feedback
5. **Iterate:** Fix what breaks, add what's missing
6. **Charge:** Add pricing, start billing

**One thing at a time.** Don't build everything — build what gets you paid.
