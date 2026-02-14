# Cloudflare Tunnel Setup - PERMANENT FREE SOLUTION

## Quick Start

```powershell
npm run phone:cloudflare
```

That's it! This will:
1. ✅ Start your phone server
2. ✅ Start Cloudflare Tunnel
3. ✅ Get the tunnel URL automatically
4. ✅ Update your .env file
5. ✅ Auto-update Twilio webhook
6. ✅ Copy URL to clipboard

## How It Works

Cloudflare Tunnel gives you a **free permanent URL** (well, it changes if you restart, but you can get a named tunnel for a truly permanent one).

The script:
- Starts your server on port 3001 (or whatever `PHONE_SERVER_PORT` is set to)
- Starts `cloudflared tunnel --url http://localhost:3001`
- Captures the URL from cloudflared output
- Updates Twilio automatically via API
- Keeps everything running

## Getting a Truly Permanent URL (Optional)

If you want a URL that NEVER changes:

1. Sign up free at https://one.dash.cloudflare.com
2. Create a tunnel: `cloudflared tunnel create voicemail-assistant`
3. Get your tunnel ID
4. Configure it: `cloudflared tunnel route dns voicemail-assistant your-subdomain.yourdomain.com`
5. Run: `cloudflared tunnel run voicemail-assistant`

But for testing, the simple `--url` method works great!

## Manual Command (if script doesn't work)

```powershell
# Terminal 1: Start server
cd receptionist
node phone_server.js

# Terminal 2: Start tunnel
cloudflared tunnel --url http://localhost:3001
```

Copy the URL it gives you (like `https://abc123.trycloudflare.com`) and set Twilio webhook to `https://abc123.trycloudflare.com/voice`

## Troubleshooting

**"cloudflared not found"**
- Download from: https://github.com/cloudflare/cloudflared/releases
- Put it in your PATH or same folder as script

**URL not captured**
- Check `cloudflared-output.txt` file
- The URL should be in there

**Twilio update fails**
- That's okay! Just copy the webhook URL and update manually in Twilio console

## Benefits Over Ngrok

- ✅ Free forever
- ✅ No rate limits (for this use case)
- ✅ Can get permanent subdomain (named tunnel)
- ✅ More reliable
- ✅ No account needed for basic use
