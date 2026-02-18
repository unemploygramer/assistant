-- Optional: Row Level Security (RLS) for business_profiles and leads
-- Run this in Supabase SQL Editor if you want users to only see their own data.
-- Ensure business_profiles.user_id is set for each row (link to auth.users.id).

-- 1. Enable RLS on business_profiles
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Users can only see and update their own profile(s)
CREATE POLICY "Users can view own business_profiles"
  ON public.business_profiles FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own business_profiles"
  ON public.business_profiles FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own business_profiles"
  ON public.business_profiles FOR UPDATE
  USING (auth.uid()::text = user_id);

-- 3. Optional: scope leads by business (if you add business_profile_id or owner to leads later)
-- For now the phone server writes leads without user_id; you can add a policy later when leads are linked to profiles.

-- Note: Existing rows with user_id = NULL will not be visible to any logged-in user.
-- To assign an existing profile to a user, run:
--   UPDATE business_profiles SET user_id = 'YOUR_AUTH_USER_UUID' WHERE id = 'PROFILE_ID';
