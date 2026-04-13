-- Migration: Global Database Cleanup and Optimization
-- Purpose: Remove redundant tables, strengthen security, and add missing performance indexes.

-- 1. DROP REDUNDANT TABLES
-- 'deposits' was a legacy construct replaced by the more robust 'incomes' system.
-- It also has RLS disabled, making it a potential security hole.
DROP TABLE IF EXISTS public.deposits;

-- 2. SECURITY HARDENING
-- Ensure all tables have RLS enabled (just in case they were added without it)
ALTER TABLE IF EXISTS public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ledger_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stock_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transfers ENABLE ROW LEVEL SECURITY;

-- 3. PERFORMANCE INDEXING
-- 3.1 Ledger filtering optimization
CREATE INDEX IF NOT EXISTS idx_ledger_logs_action_type ON public.ledger_logs(action_type);

-- 3.2 Investment & Trades optimization
CREATE INDEX IF NOT EXISTS idx_stock_trades_symbol ON public.stock_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_stock_trades_trade_date ON public.stock_trades(trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_investments_symbol ON public.investments(symbol);
CREATE INDEX IF NOT EXISTS idx_investments_bought_at ON public.investments(bought_at DESC);

-- 3.3 Profiles optimization
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- 4. CLEANUP AUDIT UTILS (Optional, keeping them if user wants repeated audits, but dropping for now to leave DB clean)
DROP FUNCTION IF EXISTS audit_get_schemas();
DROP FUNCTION IF EXISTS audit_get_tables();
DROP FUNCTION IF EXISTS audit_get_indexes();
