-- Migration: Database Performance & Index Optimization
-- Date: 2026-06-19
-- Purpose: Index unindexed foreign keys and clean up redundant single-column and duplicate composite indexes.

-- 1. Index Unindexed Foreign Keys to optimize referential integrity checks and joins
CREATE INDEX IF NOT EXISTS idx_bond_transactions_account_id ON public.bond_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_fno_trades_account_id ON public.fno_trades(account_id);
CREATE INDEX IF NOT EXISTS idx_fno_trades_close_ledger_log_id ON public.fno_trades(close_ledger_log_id);
CREATE INDEX IF NOT EXISTS idx_fno_trades_ledger_log_id ON public.fno_trades(ledger_log_id);
CREATE INDEX IF NOT EXISTS idx_forex_transactions_bank_account_id ON public.forex_transactions(bank_account_id);

-- 2. Drop Redundant / Duplicate Unused Indexes
-- Drop single-column primary key duplicate
DROP INDEX IF EXISTS public.idx_profiles_id;

-- Drop single-column date/maturity indexes covered by user_id composite indexes
DROP INDEX IF EXISTS public.idx_transactions_date;
DROP INDEX IF EXISTS public.idx_expenses_date;
DROP INDEX IF EXISTS public.idx_bond_transactions_date;
DROP INDEX IF EXISTS public.idx_stock_trades_trade_date;
DROP INDEX IF EXISTS public.idx_bonds_maturity_date;
DROP INDEX IF EXISTS public.idx_incomes_date;
DROP INDEX IF EXISTS public.idx_investments_bought_at;

-- Drop single-column user_id indexes covered by composite user_id indexes
DROP INDEX IF EXISTS public.idx_goals_user_id;
DROP INDEX IF EXISTS public.idx_investments_user_id;
DROP INDEX IF EXISTS public.idx_ledger_logs_user_id;
DROP INDEX IF EXISTS public.idx_fno_trades_user_id;
DROP INDEX IF EXISTS public.idx_mutual_fund_trades_user_id;
DROP INDEX IF EXISTS public.idx_forex_trades_user;
DROP INDEX IF EXISTS public.idx_forex_transactions_user;

-- Drop duplicate composite indexes on ledger_logs(user_id, created_at DESC)
-- We keep public.idx_ledger_logs_user_created_at
DROP INDEX IF EXISTS public.idx_ledger_logs_user_created;
DROP INDEX IF EXISTS public.idx_ledger_user_created;

-- Drop unused low-cardinality status and symbol indexes on fno_trades
DROP INDEX IF EXISTS public.idx_fno_trades_status;
DROP INDEX IF EXISTS public.idx_fno_trades_symbol;

-- 3. Replace single-column transfers(created_at desc) with composite index transfers(user_id, created_at desc)
DROP INDEX IF EXISTS public.idx_transfers_created_at;
CREATE INDEX IF NOT EXISTS idx_transfers_user_created ON public.transfers(user_id, created_at DESC);
