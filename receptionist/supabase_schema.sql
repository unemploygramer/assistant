-- Supabase Schema for AI Receptionist
-- Run this SQL in your Supabase SQL Editor

-- Sessions table: Stores active call transcripts (recovered on restart)
CREATE TABLE IF NOT EXISTS sessions (
  call_sid TEXT PRIMARY KEY,
  transcript_buffer JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads table: Final processed leads
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  phone TEXT,
  transcript TEXT,
  summary JSONB,
  status TEXT DEFAULT 'new',
  industry TEXT,
  call_sid TEXT,
  from_number TEXT
);

-- Notifications table: SMS/email notifications (A2P workaround)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  message_body TEXT NOT NULL,
  sent_status TEXT DEFAULT 'pending',
  notification_type TEXT DEFAULT 'sms',
  error_message TEXT,
  twilio_message_sid TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_notifications_lead_id ON notifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_status ON notifications(sent_status);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on sessions
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - Enable if needed for multi-tenant
-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
