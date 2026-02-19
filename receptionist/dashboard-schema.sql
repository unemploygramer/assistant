-- Business Profiles Table for Bot Configuration Dashboard
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Basic Business Info
  business_name TEXT NOT NULL,
  user_id TEXT, -- For multi-tenant: link to auth.users.id
  
  -- Bot Configuration (JSONB for flexibility)
  bot_config JSONB DEFAULT '{
    "tone": "professional",
    "customKnowledge": "",
    "requiredLeadInfo": []
  }'::jsonb,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  twilio_phone_number TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id ON business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_active ON business_profiles(is_active) WHERE is_active = true;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_business_profiles_updated_at 
  BEFORE UPDATE ON business_profiles
  FOR EACH ROW 
  EXECUTE FUNCTION update_business_profiles_updated_at();

-- RLS (Row Level Security) - Enable if needed
-- ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users can view own profiles" ON business_profiles FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can update own profiles" ON business_profiles FOR UPDATE USING (auth.uid() = user_id);
