-- Performance optimizations for RLS policies and Indexing
-- 1. Indexing all user_id columns to prevent sequential scans
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_user_id ON public.transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON public.deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_trades_user_id ON public.stock_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_mutual_funds_user_id ON public.mutual_funds(user_id);
CREATE INDEX IF NOT EXISTS idx_mutual_fund_trades_user_id ON public.mutual_fund_trades(user_id);

-- 2. Replacing auth.uid() with (select auth.uid()) for optimal execution plan in Postgres
--    This prevents Postgres from calling auth.uid() on each evaluated row.

-- Profiles
DROP POLICY IF EXISTS "Profiles are viewable by owner only" ON public.profiles;
CREATE POLICY "Profiles are viewable by owner only" ON public.profiles
    FOR SELECT USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (id = (SELECT auth.uid()));

-- Accounts
DROP POLICY IF EXISTS "Users can manage their own accounts" ON public.accounts;
CREATE POLICY "Users can manage their own accounts" ON public.accounts
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Transactions
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions" ON public.transactions
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Transfers
DROP POLICY IF EXISTS "Users can view their own transfers" ON public.transfers;
CREATE POLICY "Users can view their own transfers" ON public.transfers
    FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create their own transfers" ON public.transfers;
CREATE POLICY "Users can create their own transfers" ON public.transfers
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

-- Deposits
DROP POLICY IF EXISTS "Users can view their own deposits" ON public.deposits;
CREATE POLICY "Users can view their own deposits" ON public.deposits
    FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can create their own deposits" ON public.deposits;
CREATE POLICY "Users can create their own deposits" ON public.deposits
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

-- Ledger Logs
DROP POLICY IF EXISTS "Users can view their own ledger logs" ON public.ledger_logs;
CREATE POLICY "Users can view their own ledger logs" ON public.ledger_logs
    FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own ledger logs" ON public.ledger_logs;
CREATE POLICY "Users can insert their own ledger logs" ON public.ledger_logs
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own ledger logs" ON public.ledger_logs;
CREATE POLICY "Users can delete their own ledger logs" ON public.ledger_logs
    FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Expenses
DROP POLICY IF EXISTS "Users can manage their own expenses" ON public.expenses;
CREATE POLICY "Users can manage their own expenses" ON public.expenses
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Incomes
DROP POLICY IF EXISTS "Users can manage their own incomes" ON public.incomes;
CREATE POLICY "Users can manage their own incomes" ON public.incomes
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Recipients
DROP POLICY IF EXISTS "Users can manage their own recipients" ON public.recipients;
CREATE POLICY "Users can manage their own recipients" ON public.recipients
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Investments
DROP POLICY IF EXISTS "Users can manage their own investments" ON public.investments;
CREATE POLICY "Users can manage their own investments" ON public.investments
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Stock Trades
DROP POLICY IF EXISTS "Users can manage their own stock trades" ON public.stock_trades;
CREATE POLICY "Users can manage their own stock trades" ON public.stock_trades
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Goals
DROP POLICY IF EXISTS "Users can manage their own goals" ON public.goals;
CREATE POLICY "Users can manage their own goals" ON public.goals
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Mutual Funds
DROP POLICY IF EXISTS "Users can manage their own mutual funds" ON public.mutual_funds;
CREATE POLICY "Users can manage their own mutual funds" ON public.mutual_funds
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own mf trades" ON public.mutual_fund_trades;
CREATE POLICY "Users can view their own mf trades" ON public.mutual_fund_trades
    FOR SELECT USING (user_id = (SELECT auth.uid()));
