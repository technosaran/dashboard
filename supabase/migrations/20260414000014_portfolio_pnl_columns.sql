
-- Migration: Portfolio Schema Completion
-- Purpose: Add missing realized_pnl columns to main portfolio tables to support sell logic.

ALTER TABLE IF EXISTS public.investments ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE IF EXISTS public.mutual_funds ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC(14, 2) DEFAULT 0;

-- Ensure mutual_funds has fund_symbol which is used for matching
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mutual_funds' AND column_name='fund_symbol') THEN
        ALTER TABLE public.mutual_funds ADD COLUMN fund_symbol TEXT;
    END IF;
END $$;
