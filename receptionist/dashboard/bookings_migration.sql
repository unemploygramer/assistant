-- Paper Trading Calendar: Internal bookings (no Google Calendar)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,

  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  service_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_business ON bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

COMMENT ON TABLE bookings IS 'Internal paper-trading appointments. Not synced to Google Calendar.';
