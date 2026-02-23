-- Twilio Number Pool - System-managed phone numbers
-- Run this SQL in your Supabase SQL Editor
-- Then add your numbers: see "Seed numbers" section at the bottom

CREATE TABLE IF NOT EXISTS twilio_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Twilio number details
  phone_number TEXT NOT NULL UNIQUE,
  sid TEXT, -- Twilio Phone Number SID (e.g. PN...)

  -- Pool status
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned')),
  business_profile_id UUID REFERENCES business_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_twilio_numbers_status ON twilio_numbers(status) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_twilio_numbers_phone ON twilio_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_twilio_numbers_business ON twilio_numbers(business_profile_id) WHERE business_profile_id IS NOT NULL;

-- When a business profile is deleted (e.g. nuke), release the number back to the pool
CREATE OR REPLACE FUNCTION release_twilio_number_on_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE twilio_numbers
  SET status = 'available', business_profile_id = NULL, updated_at = NOW()
  WHERE business_profile_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_release_twilio_number
  BEFORE DELETE ON business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION release_twilio_number_on_profile_delete();

-- =============================================================================
-- SEED NUMBERS: Run after migration. Get SIDs from Twilio Console.
-- https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
-- =============================================================================
-- INSERT INTO twilio_numbers (phone_number, sid, status) VALUES
--   ('+15153053199', 'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'available'),
--   ('+15156196628', 'PNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'available');
