-- Total Real-time Coverage v2 (Broadcasting)
-- This migration ensures that EVERY table we care about is broadcasting full data to all connected clients.

DO $$
BEGIN
    -- 1. Ensure the publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- 2. Add all key tables to the publication
    -- Using individual ALTER commands to handle tables that might already exist in the publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.incomes;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_logs;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.deposits;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.recipients;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 3. Force FULL replica identity on critical tables
-- This ensures that real-time updates carry ALL column data, preventing "stale" or "incomplete" updates on the frontend.
ALTER TABLE public.accounts REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.incomes REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.ledger_logs REPLICA IDENTITY FULL;
ALTER TABLE public.transfers REPLICA IDENTITY FULL;
