-- Add owner_phone to business_profiles so we know who to text when a lead comes in.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor).

ALTER TABLE public.business_profiles
ADD COLUMN IF NOT EXISTS owner_phone text;

COMMENT ON COLUMN public.business_profiles.owner_phone IS 'E.164 number to receive SMS lead alerts (e.g. +17145551234)';
