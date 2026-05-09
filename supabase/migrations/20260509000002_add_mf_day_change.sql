
-- Migration: Add day change columns to mutual_funds
-- Purpose: Enable "Day's P&L" tracking for mutual funds by storing previous NAV

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mutual_funds' AND column_name='previous_nav') THEN
        ALTER TABLE public.mutual_funds ADD COLUMN previous_nav NUMERIC(14, 4);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mutual_funds' AND column_name='day_change') THEN
        ALTER TABLE public.mutual_funds ADD COLUMN day_change NUMERIC(14, 4);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mutual_funds' AND column_name='day_change_percent') THEN
        ALTER TABLE public.mutual_funds ADD COLUMN day_change_percent NUMERIC(14, 4);
    END IF;
END $$;
