-- ADVANCED PERFORMANCE INDEXES
-- Optimized for get_finance_overview RPC and real-time dashboard responsiveness

-- Accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user_name ON public.accounts(user_id, name);

-- Transactions
DROP INDEX IF EXISTS idx_transactions_user_id;
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);

-- Ledger Logs
DROP INDEX IF EXISTS idx_ledger_user_id;
CREATE INDEX IF NOT EXISTS idx_ledger_user_created ON public.ledger_logs(user_id, created_at DESC);

-- Goals
CREATE INDEX IF NOT EXISTS idx_goals_user_created ON public.goals(user_id, created_at DESC);

-- Recipients
CREATE INDEX IF NOT EXISTS idx_recipients_user_name ON public.recipients(user_id, name);

-- Incomes
DROP INDEX IF EXISTS idx_incomes_user_id;
CREATE INDEX IF NOT EXISTS idx_incomes_user_date ON public.incomes(user_id, date DESC);

-- Expenses
DROP INDEX IF EXISTS idx_expenses_user_id;
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, date DESC);

-- Stock Trades
CREATE INDEX IF NOT EXISTS idx_stock_trades_user_date ON public.stock_trades(user_id, trade_date DESC);

-- Mutual Fund Trades
CREATE INDEX IF NOT EXISTS idx_mf_trades_user_date ON public.mutual_fund_trades(user_id, date DESC);

-- Investment & Mutual Fund Holdings (usually few records per user, but for scale)
CREATE INDEX IF NOT EXISTS idx_investments_user_type ON public.investments(user_id, type);
CREATE INDEX IF NOT EXISTS idx_mutual_funds_user_name ON public.mutual_funds(user_id, fund_name);
