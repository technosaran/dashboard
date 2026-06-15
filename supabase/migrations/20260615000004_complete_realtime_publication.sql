-- Complete Realtime Publication for all remaining tables
-- This ensures that any insert, update, or delete on any table triggers instant real-time sync.

DO $$
BEGIN
    -- Ensure publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Add all newer/remaining tables to publication
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.investments; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mutual_funds; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bonds; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.alternative_assets; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_trades; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mutual_fund_trades; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bond_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fno_trades; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.budgets; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.goals; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.liabilities; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.forex_accounts; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.forex_trades; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.forex_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Force FULL replica identity on all these tables for complete payload realtime updates
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.investments REPLICA IDENTITY FULL;
ALTER TABLE public.mutual_funds REPLICA IDENTITY FULL;
ALTER TABLE public.bonds REPLICA IDENTITY FULL;
ALTER TABLE public.alternative_assets REPLICA IDENTITY FULL;
ALTER TABLE public.stock_trades REPLICA IDENTITY FULL;
ALTER TABLE public.mutual_fund_trades REPLICA IDENTITY FULL;
ALTER TABLE public.bond_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.fno_trades REPLICA IDENTITY FULL;
ALTER TABLE public.budgets REPLICA IDENTITY FULL;
ALTER TABLE public.goals REPLICA IDENTITY FULL;
ALTER TABLE public.liabilities REPLICA IDENTITY FULL;
ALTER TABLE public.forex_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.forex_trades REPLICA IDENTITY FULL;
ALTER TABLE public.forex_transactions REPLICA IDENTITY FULL;
