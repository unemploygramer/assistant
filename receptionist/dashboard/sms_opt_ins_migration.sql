-- SMS Opt-Ins Table - For TCPA-compliant consent
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sms_opt_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Normalized E.164 phone number
  phone TEXT NOT NULL,

  -- Consent metadata
  consented_at TIMESTAMPTZ DEFAULT NOW(),
  consent_source TEXT DEFAULT 'web',  -- 'web' | 'call' | 'signup'

  -- Optional: link to business (for multi-tenant)
  business_profile_id UUID REFERENCES business_profiles(id) ON DELETE SET NULL,

  -- Prevent duplicate opt-ins (one per phone globally for now)
  UNIQUE(phone)
);

CREATE INDEX IF NOT EXISTS idx_sms_opt_ins_phone ON sms_opt_ins(phone);
CREATE INDEX IF NOT EXISTS idx_sms_opt_ins_business ON sms_opt_ins(business_profile_id);

-- Allow anonymous inserts for opt-in (public signup)
ALTER TABLE sms_opt_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert for opt-in" ON sms_opt_ins FOR INSERT TO anon WITH CHECK (true);
