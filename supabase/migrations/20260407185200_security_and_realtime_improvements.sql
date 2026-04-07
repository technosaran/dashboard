-- Security Improvements for Transfers and Deposits tables
-- Enabling RLS and creating proper policies to prevent data leakage

-- 1. Transfers Table Security
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transfers" ON public.transfers;
CREATE POLICY "Users can view their own transfers" 
  ON public.transfers FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own transfers" ON public.transfers;
CREATE POLICY "Users can create their own transfers" 
  ON public.transfers FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 2. Deposits Table Security
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own deposits" ON public.deposits;
CREATE POLICY "Users can view their own deposits" 
  ON public.deposits FOR SELECT 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own deposits" ON public.deposits;
CREATE POLICY "Users can create their own deposits" 
  ON public.deposits FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 3. Set Replica Identity to Full for all core tables to improve Realtime reliability
ALTER TABLE public.accounts REPLICA IDENTITY FULL;
ALTER TABLE public.transfers REPLICA IDENTITY FULL;
ALTER TABLE public.deposits REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
