# Vercel Deployment Checklist

## ✅ Fixed Issues
- [x] TypeScript error in `lib/supabase/server.ts` - Fixed `cookiesToSet` parameter type

## 📁 Deployment Settings
- **Root Directory:** `receptionist/dashboard` ✅ (Correct - this is where your Next.js app lives)
- **Framework Preset:** Next.js ✅

## 🔐 Environment Variables Required in Vercel

Go to **Project Settings → Environment Variables** and add these:

### Required (for Supabase auth):
```
NEXT_PUBLIC_SUPABASE_URL=https://wjxogknqcskqjynaqdeo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqeG9na25xY3NrcWp5bmFxZGVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDE0NjAsImV4cCI6MjA4NjU3NzQ2MH0.qgd4jsuGIySALJ2yV208SqKgdoLfosN-iFOoigbNugM
```

### Optional (for contact form):
```
CONTACT_EMAIL_TO=codedbytyler@gmail.com
CONTACT_EMAIL_APP_PASSWORD=your-gmail-app-password
```

**Note:** Set these for **Production**, **Preview**, and **Development** environments (or at least Production).

## 🚀 After Deployment

1. Your dashboard will be live at: `https://assistant.vercel.app` (or your custom domain)
2. The privacy policy and terms pages will be at:
   - `https://assistant.vercel.app/privacy-policy.html`
   - `https://assistant.vercel.app/terms-and-conditions.html`
3. Update your Twilio campaign URLs to use the Vercel domain instead of the tunnel URL

## ⚠️ Potential Issues to Watch For

1. **Build succeeds but runtime errors:** Check Vercel function logs if API routes fail
2. **Supabase auth not working:** Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly
3. **Static files not loading:** Check `public/` folder is included in build
4. **Environment variables not loading:** Make sure they're set for the right environment (Production/Preview)
