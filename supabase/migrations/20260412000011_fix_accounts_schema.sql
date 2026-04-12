-- Migration: Align accounts schema with recipients and newer logic
-- Purpose: Add missing columns assumed by recent RPC updates

ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS institution TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Migration: Data Seeding/Fix (Copy bank_name to institution if bank_name exists and institution is null)
UPDATE public.accounts SET institution = bank_name WHERE institution IS NULL AND bank_name IS NOT NULL;
