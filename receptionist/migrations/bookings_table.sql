-- In-app calendar: appointments when Google Calendar is not configured or fails.
-- Run in Supabase SQL Editor. Links to business_profiles.id.

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  service_type TEXT,
  status TEXT DEFAULT 'scheduled',
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_business_id ON bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);

COMMENT ON TABLE bookings IS 'In-app appointments; used when Google Calendar is not linked or fails.';
