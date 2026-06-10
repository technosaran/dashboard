-- Migration: Add Real-time Performance Indexes
-- Date: 2026-06-10
-- Purpose: Optimize database read performance by creating composite indexes on public tables tailored to query filters and sorting keys.

-- 1. Accounts: optimize retrieval sorted by balance
CREATE INDEX IF NOT EXISTS idx_accounts_user_balance ON public.accounts(user_id, balance DESC);

-- 2. Goals: optimize retrieval sorted by deadline
CREATE INDEX IF NOT EXISTS idx_goals_user_deadline ON public.goals(user_id, deadline ASC);

-- 3. Bonds: optimize retrieval sorted by maturity_date
CREATE INDEX IF NOT EXISTS idx_bonds_user_maturity ON public.bonds(user_id, maturity_date ASC);

-- 4. Alternative Assets: optimize retrieval sorted by current_value
CREATE INDEX IF NOT EXISTS idx_alt_assets_user_value ON public.alternative_assets(user_id, current_value DESC);

-- 5. FnO Trades: optimize retrieval sorted by trade_date and created_at
CREATE INDEX IF NOT EXISTS idx_fno_trades_user_date ON public.fno_trades(user_id, trade_date DESC, created_at DESC);

-- 6. Forex Trades: optimize retrieval sorted by trade_date
CREATE INDEX IF NOT EXISTS idx_forex_trades_user_date ON public.forex_trades(user_id, trade_date DESC);

-- 7. Forex Transactions: optimize retrieval sorted by transaction_date
CREATE INDEX IF NOT EXISTS idx_forex_transactions_user_date ON public.forex_transactions(user_id, transaction_date DESC);

-- 8. Bond Transactions: optimize retrieval sorted by transaction_date
CREATE INDEX IF NOT EXISTS idx_bond_transactions_user_date ON public.bond_transactions(user_id, transaction_date DESC);

-- 9. Liabilities: optimize retrieval sorted by remaining_amount
CREATE INDEX IF NOT EXISTS idx_liabilities_user_amount ON public.liabilities(user_id, remaining_amount DESC);
