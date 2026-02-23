-- Product Launch: Demo number, demo leads, Stripe subscription
-- Run in Supabase SQL Editor

-- 1. Mark which Twilio number is the public demo (fetch by is_demo = true for /api/demo-number)
ALTER TABLE public.twilio_numbers
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.twilio_numbers.is_demo IS 'When true, this number is shown on the public demo page and uses Demo Mode in the phone server.';

-- Set which number is the public demo (run after seeding numbers):
-- UPDATE twilio_numbers SET is_demo = false;
-- UPDATE twilio_numbers SET is_demo = true WHERE phone_number = '+15153053199';

-- 2. Mark demo leads (so we can filter or send sample email to dev)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.is_demo IS 'True when the call was to/from the demo number (Baddie Demo Corp.).';

-- 3. Stripe / subscription for business_profiles (paid tier)
ALTER TABLE public.business_profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.business_profiles.subscription_status IS 'e.g. active, canceled, past_due. Used to gate features.';
COMMENT ON COLUMN public.business_profiles.stripe_customer_id IS 'Stripe customer ID (cus_...) for billing.';
COMMENT ON COLUMN public.business_profiles.stripe_subscription_id IS 'Stripe subscription ID (sub_...) for recurring billing.';
