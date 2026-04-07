-- Security and Reliability Fixes for Profiles Table
-- 1. Tighten the RLS policy for profiles (Only owner can view their own profile)
-- 2. Set REPLICA IDENTITY to FULL for profiles to ensure complete real-time payloads

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create more secure policy
CREATE POLICY "Profiles are viewable by owner only" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Set Replica Identity to Full for real-time reliability
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
