-- Call Ended Logs Table - Track when call-ended fires and any errors
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS call_ended_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Call info
  call_sid TEXT NOT NULL,
  call_status TEXT, -- 'completed', 'canceled', 'failed', etc.
  twilio_to_number TEXT, -- Business line (number that received call)
  twilio_from_number TEXT, -- Caller number
  
  -- Processing status
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
  error_message TEXT,
  error_stack TEXT,
  
  -- Results (if successful)
  lead_id UUID, -- Links to leads.id if lead was saved
  email_sent BOOLEAN DEFAULT false,
  sms_sent BOOLEAN DEFAULT false,
  
  -- Metadata
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_call_ended_logs_call_sid ON call_ended_logs(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_ended_logs_created_at ON call_ended_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_ended_logs_status ON call_ended_logs(status);
CREATE INDEX IF NOT EXISTS idx_call_ended_logs_twilio_to ON call_ended_logs(twilio_to_number);

-- Function to get last call info for a business line
CREATE OR REPLACE FUNCTION get_last_call_info(business_number TEXT)
RETURNS TABLE (
  call_sid TEXT,
  call_status TEXT,
  created_at TIMESTAMPTZ,
  status TEXT,
  error_message TEXT,
  lead_id UUID,
  email_sent BOOLEAN,
  sms_sent BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cel.call_sid,
    cel.call_status,
    cel.created_at,
    cel.status,
    cel.error_message,
    cel.lead_id,
    cel.email_sent,
    cel.sms_sent
  FROM call_ended_logs cel
  WHERE cel.twilio_to_number = business_number
  ORDER BY cel.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
