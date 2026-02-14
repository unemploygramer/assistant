# Production Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase

1. Create a Supabase project at https://supabase.com
2. Go to SQL Editor and run `supabase_schema.sql`
3. Copy your project URL and anon key from Settings > API

### 3. Configure Environment

Copy `ENV_TEMPLATE.txt` to `.env` in the root directory and fill in:

**Required:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `OPENROUTER_KEY` - Your OpenRouter API key
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `MY_CELL_NUMBER` - Your cell number to receive notifications
- `PUBLIC_URL` - Your public server URL (for Twilio webhooks)

**Optional:**
- `USE_TWILIO_SMS` - Set to `false` to log notifications to database only (A2P workaround)
- `ELEVENLABS_KEY` - For premium voice (falls back to Twilio TTS)
- `BUSINESS_NAME` - Your business name

### 4. Configure Twilio Webhook

1. Go to Twilio Console > Phone Numbers > Manage > Active Numbers
2. Click your phone number
3. Set Voice & Fax webhook URL to: `https://your-domain.com/voice`
4. Set Status Callback URL to: `https://your-domain.com/call-ended`

### 5. Run Server

```bash
npm run phone
```

Or with ngrok for local development:
```bash
npm run phone:dev
```

## Key Features

### ✅ Session Persistence
- All call transcripts saved to Supabase `sessions` table
- Calls survive server restarts (recovered from database)
- Every utterance upserted in real-time

### ✅ Lead Management
- Leads automatically saved to `leads` table on call completion
- GPT-4o generates structured summary (name, phone, service, urgency)
- Full transcript preserved

### ✅ A2P Workaround
- Set `USE_TWILIO_SMS=false` to log notifications to database
- All notifications saved to `notifications` table
- Can enable SMS later after A2P registration

### ✅ Resilience
- Calls stay live even if ElevenLabs fails (falls back to Twilio TTS)
- Calls stay live even if OpenRouter fails (returns fallback message)
- Database errors don't crash the call flow
- All non-critical failures are logged and continue

### ✅ Professional AI
- Hardcoded professional system prompt for residential services
- Natural conversation flow
- Collects: name, phone, service, urgency, callback time, address

## Database Schema

### `sessions` Table
- `call_sid` (PK) - Twilio Call SID
- `transcript_buffer` (JSONB) - Array of {role, content} messages
- `metadata` (JSONB) - Call metadata (fromNumber, startTime)
- `created_at`, `updated_at` - Timestamps

### `leads` Table
- `id` (PK) - UUID
- `phone` - Phone number
- `transcript` - Full conversation transcript
- `summary` (JSONB) - Structured lead data
- `status` - Lead status (new, contacted, closed)
- `industry` - Business industry
- `call_sid` - Twilio Call SID
- `from_number` - Caller's number
- `created_at` - Timestamp

### `notifications` Table
- `id` (PK) - UUID
- `lead_id` (FK) - Reference to leads table
- `message_body` - Notification text
- `sent_status` - pending, sent, failed, logged
- `notification_type` - sms, email
- `error_message` - Error details if failed
- `twilio_message_sid` - Twilio message SID if sent
- `created_at` - Timestamp

## API Endpoints

- `POST /voice` - Incoming call handler
- `POST /gather` - Speech input handler
- `POST /call-ended` - Call completion handler
- `POST /sms-status` - SMS delivery status callback
- `GET /health` - Health check

## Monitoring

Check Supabase dashboard for:
- Active sessions (ongoing calls)
- New leads
- Notification delivery status

## Troubleshooting

**Calls not persisting?**
- Check Supabase credentials in `.env`
- Verify `sessions` table exists
- Check server logs for database errors

**SMS not sending?**
- Set `USE_TWILIO_SMS=true` in `.env`
- Check Twilio credentials
- Verify A2P 10DLC registration (if required)
- Notifications still logged to database even if SMS fails

**AI not responding?**
- Check OpenRouter API key
- Verify API quota/limits
- System falls back gracefully - calls stay live

**ElevenLabs audio not working?**
- Check `PUBLIC_URL` is set correctly
- Falls back to Twilio TTS automatically
- Check ElevenLabs API key and voice ID
