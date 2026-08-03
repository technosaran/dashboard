-- Migration: Audit Performance Indexing for Multi-Asset Tables & Composite User Queries
-- Purpose: Add targeted composite and foreign key indexes to ensure sub-millisecond query performance at scale.

-- 1. Core Financial Tables (Composite User + Date/Category Indexes)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON public.incomes(user_id, date DESC);

-- 2. Bonds
CREATE INDEX IF NOT EXISTS idx_bonds_user_id ON public.bonds(user_id);
CREATE INDEX IF NOT EXISTS idx_bonds_status ON public.bonds(status);
CREATE INDEX IF NOT EXISTS idx_bonds_maturity_date ON public.bonds(maturity_date DESC);

-- 3. Futures & Options (F&O) Trades
CREATE INDEX IF NOT EXISTS idx_fno_trades_user_id ON public.fno_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_fno_trades_status ON public.fno_trades(status);
CREATE INDEX IF NOT EXISTS idx_fno_trades_expiry_date ON public.fno_trades(expiry_date DESC);
CREATE INDEX IF NOT EXISTS idx_fno_trades_symbol ON public.fno_trades(symbol);

-- 4. Forex Trades & Accounts
CREATE INDEX IF NOT EXISTS idx_forex_trades_user_id ON public.forex_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_forex_trades_account ON public.forex_trades(forex_account_id);
CREATE INDEX IF NOT EXISTS idx_forex_accounts_user_id ON public.forex_accounts(user_id);

-- 5. Alternative Assets
CREATE INDEX IF NOT EXISTS idx_alternative_assets_user_id ON public.alternative_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_alternative_assets_category ON public.alternative_assets(category);
