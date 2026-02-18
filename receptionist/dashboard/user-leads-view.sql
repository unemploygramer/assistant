-- Create user_leads view that joins leads with business_profiles
-- This view filters leads by the logged-in user's business profile
-- Run this in Supabase SQL Editor

CREATE OR REPLACE VIEW user_leads AS
SELECT 
  l.id,
  l.phone,
  l.transcript,
  l.summary,
  l.status,
  l.industry,
  l.call_sid,
  l.from_number,
  l.created_at,
  bp.user_id,
  bp.business_name,
  bp.twilio_phone_number
FROM leads l
LEFT JOIN business_profiles bp ON l.from_number = bp.twilio_phone_number
WHERE bp.user_id IS NOT NULL;

-- Grant access to authenticated users (if RLS is enabled)
-- GRANT SELECT ON user_leads TO authenticated;

-- Optional: Add index on from_number for better performance
CREATE INDEX IF NOT EXISTS idx_leads_from_number ON leads(from_number);
