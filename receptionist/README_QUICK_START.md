# Quick Start - One Command

## 🚀 Start Everything

```powershell
npm run phone:start
```

That's it! This will:
1. ✅ Start ngrok
2. ✅ Get the ngrok URL automatically
3. ✅ Update your `.env` file
4. ✅ Copy URL to clipboard
5. ✅ Start the phone server
6. ✅ Show you the Twilio webhook URL

## 📋 What You'll See

```
✅ NGROK URL:
   https://abc123xyz.ngrok-free.dev

🔗 Twilio Webhook URL:
   https://abc123xyz.ngrok-free.dev/voice
```

## 🔧 Update Twilio (One Time Per Session)

1. Copy the webhook URL from console
2. Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
3. Click your phone number
4. Paste URL into "Voice webhook" field
5. Save

## 🎯 That's It!

Now call your number and it should work!

---

**Note:** If ngrok URL changes (it does on free tier), just run `npm run phone:start` again and update Twilio webhook with the new URL.
