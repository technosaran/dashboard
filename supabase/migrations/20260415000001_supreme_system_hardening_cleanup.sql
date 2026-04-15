-- migration: 20260415000001_supreme_system_hardening_cleanup.sql
-- Purpose: Purge redundant tables and columns, and enforce security policies on audit tables.

-- 1. Remove Obsolete Table
DROP TABLE IF EXISTS public.deposits;

-- 2. Lean out Family & Friends module
-- These columns are no longer used in the simplified, ultra-minimalist UI
ALTER TABLE public.recipients 
DROP COLUMN IF EXISTS account_number,
DROP COLUMN IF EXISTS bank_name;

-- 3. Optimization: Drop redundant logo URL column
-- We use a dynamic logo resolver in the frontend based on the bank_name string
ALTER TABLE public.accounts DROP COLUMN IF EXISTS bank_logo;

-- 4. Security Hardening: Enable RLS on Transfers
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'transfers' AND policyname = 'Users can view their own transfers'
    ) THEN
        CREATE POLICY "Users can view their own transfers"
        ON public.transfers FOR SELECT
        USING (auth.uid() = user_id);
    END IF;
END $$;
