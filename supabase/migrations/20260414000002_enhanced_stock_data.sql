
-- Migration: Enhanced Stock Data
-- Purpose: Add columns for real-time market data tracking

ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS previous_close NUMERIC(14, 2);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS day_change NUMERIC(14, 2);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS day_change_percent NUMERIC(14, 4);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS market_state TEXT;
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS last_fetch_at TIMESTAMPTZ;

-- Update existing records set last_fetch_at to current updated_at
UPDATE public.investments SET last_fetch_at = updated_at WHERE type = 'stock';
