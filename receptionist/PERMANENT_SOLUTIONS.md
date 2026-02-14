# Permanent Solutions - No More URL Changes

## Option 1: Deploy to Railway (EASIEST - 5 minutes) ⭐ RECOMMENDED

**Why:** Free tier, permanent URL, auto-deploys, zero config

**Steps:**
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Railway auto-detects Node.js
6. Add environment variables in Railway dashboard (copy from your .env)
7. Deploy
8. Get permanent URL: `https://your-app.railway.app`
9. Set Twilio webhook once, never change it again

**Cost:** Free tier = $5 credit/month (plenty for this)

**Pros:**
- ✅ Permanent URL
- ✅ Auto-deploys on git push
- ✅ Free SSL
- ✅ No ngrok needed
- ✅ Works 24/7

**Cons:**
- Need to push code to GitHub

---

## Option 2: Deploy to Render (FREE FOREVER)

**Why:** Free tier with permanent URL, no credit card needed

**Steps:**
1. Go to https://render.com
2. Sign up
3. "New" → "Web Service"
4. Connect GitHub repo
5. Settings:
   - Build Command: `npm install`
   - Start Command: `node receptionist/phone_server.js`
   - Environment: Node
6. Add environment variables
7. Deploy
8. Get URL: `https://your-app.onrender.com`

**Cost:** FREE (spins down after 15min inactivity, but wakes on request)

**Pros:**
- ✅ Completely free
- ✅ Permanent URL
- ✅ Free SSL

**Cons:**
- Spins down after inactivity (first request takes ~30sec to wake)

---

## Option 3: Cloudflare Tunnel (FREE, runs on your PC)

**Why:** Free, permanent URL, runs locally

**Steps:**
1. Install Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. Run: `cloudflared tunnel --url http://localhost:3001`
3. Get permanent URL (you can set a custom subdomain)
4. Keep terminal open

**Cost:** FREE

**Pros:**
- ✅ Free permanent URL
- ✅ Can use custom domain
- ✅ Runs on your machine

**Cons:**
- Need to keep it running
- Slightly more setup

---

## Option 4: Ngrok Paid Plan ($8/month)

**Why:** Static domain, no URL changes

**Steps:**
1. Sign up for ngrok: https://ngrok.com/pricing
2. Get static domain (e.g., `your-app.ngrok-free.app`)
3. Update your script to use: `ngrok http --domain=your-app.ngrok-free.app 3001`
4. Set Twilio webhook once

**Cost:** $8/month

**Pros:**
- ✅ Static URL
- ✅ Works with existing setup
- ✅ Reliable

**Cons:**
- Costs money
- Still need to keep ngrok running

---

## Option 5: VPS + Domain ($5-10/month)

**Why:** Full control, custom domain

**Steps:**
1. Get VPS (DigitalOcean, Linode, Vultr) - $5/month
2. Get domain ($10/year from Namecheap)
3. Deploy your code
4. Set up nginx reverse proxy
5. Point domain to VPS
6. Get SSL with Let's Encrypt (free)

**Cost:** ~$6-10/month

**Pros:**
- ✅ Full control
- ✅ Custom domain (your-app.com)
- ✅ Professional

**Cons:**
- Most setup work
- Need to manage server

---

## 🎯 MY RECOMMENDATION

**For quickest setup:** Railway (Option 1)
- Takes 5 minutes
- Permanent URL immediately
- Free tier is plenty
- Just push code and add env vars

**For completely free:** Render (Option 2)
- Free forever
- Permanent URL
- Just slower first request after inactivity

**For local development:** Cloudflare Tunnel (Option 3)
- Free
- Permanent URL
- Runs on your machine

---

## Quick Railway Setup (5 min)

1. Push your code to GitHub (if not already)
2. Go to https://railway.app → Sign up
3. "New Project" → "Deploy from GitHub"
4. Select your repo
5. Add these environment variables in Railway:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `OPENROUTER_KEY`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
   - `MY_CELL_NUMBER`
   - `USE_TWILIO_SMS=false`
   - `PHONE_SERVER_PORT=3001`
   - (all others from your .env)
6. Railway auto-deploys
7. Get URL: `https://your-app.railway.app`
8. Set Twilio webhook to: `https://your-app.railway.app/voice`
9. DONE - never change it again

Want me to help you set up Railway? It's literally the easiest.
