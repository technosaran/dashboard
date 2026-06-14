-- Migration: Fix RLS Performance (auth_rls_initplan)
-- Purpose: Wraps auth.uid() function calls inside subqueries to force PostgreSQL to evaluate the function once per query (as an InitPlan) instead of for each row.

-- 1. public.budgets
DROP POLICY IF EXISTS "Users can manage own budgets" ON public.budgets;
CREATE POLICY "Users can manage own budgets" ON public.budgets
    FOR ALL TO authenticated USING ((select auth.uid()) = user_id);

-- 2. public.alternative_assets
DROP POLICY IF EXISTS "Users can manage own alt assets" ON public.alternative_assets;
CREATE POLICY "Users can manage own alt assets" ON public.alternative_assets
    FOR ALL TO authenticated USING ((select auth.uid()) = user_id);

-- 3. public.liabilities
DROP POLICY IF EXISTS "Users can manage own liabilities" ON public.liabilities;
CREATE POLICY "Users can manage own liabilities" ON public.liabilities
    FOR ALL TO authenticated USING ((select auth.uid()) = user_id);

-- 4. public.fno_trades
DROP POLICY IF EXISTS "Users can manage their own fno trades" ON public.fno_trades;
CREATE POLICY "Users can manage their own fno trades" ON public.fno_trades
    FOR ALL USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

-- 5. public.forex_accounts
DROP POLICY IF EXISTS "Users view own forex_accounts" ON public.forex_accounts;
CREATE POLICY "Users view own forex_accounts" ON public.forex_accounts
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own forex_accounts" ON public.forex_accounts;
CREATE POLICY "Users insert own forex_accounts" ON public.forex_accounts
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own forex_accounts" ON public.forex_accounts;
CREATE POLICY "Users update own forex_accounts" ON public.forex_accounts
    FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete own forex_accounts" ON public.forex_accounts;
CREATE POLICY "Users delete own forex_accounts" ON public.forex_accounts
    FOR DELETE USING ((select auth.uid()) = user_id);

-- 6. public.forex_trades
DROP POLICY IF EXISTS "Users view own forex_trades" ON public.forex_trades;
CREATE POLICY "Users view own forex_trades" ON public.forex_trades
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own forex_trades" ON public.forex_trades;
CREATE POLICY "Users insert own forex_trades" ON public.forex_trades
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users update own forex_trades" ON public.forex_trades;
CREATE POLICY "Users update own forex_trades" ON public.forex_trades
    FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users delete own forex_trades" ON public.forex_trades;
CREATE POLICY "Users delete own forex_trades" ON public.forex_trades
    FOR DELETE USING ((select auth.uid()) = user_id);

-- 7. public.forex_transactions
DROP POLICY IF EXISTS "Users view own forex_transactions" ON public.forex_transactions;
CREATE POLICY "Users view own forex_transactions" ON public.forex_transactions
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users insert own forex_transactions" ON public.forex_transactions;
CREATE POLICY "Users insert own forex_transactions" ON public.forex_transactions
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- 8. public.bonds
DROP POLICY IF EXISTS "Users can view their own bonds" ON public.bonds;
CREATE POLICY "Users can view their own bonds" ON public.bonds
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own bonds" ON public.bonds;
CREATE POLICY "Users can insert their own bonds" ON public.bonds
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own bonds" ON public.bonds;
CREATE POLICY "Users can update their own bonds" ON public.bonds
    FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own bonds" ON public.bonds;
CREATE POLICY "Users can delete their own bonds" ON public.bonds
    FOR DELETE USING ((select auth.uid()) = user_id);

-- 9. public.bond_transactions
DROP POLICY IF EXISTS "Users can view their own bond transactions" ON public.bond_transactions;
CREATE POLICY "Users can view their own bond transactions" ON public.bond_transactions
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own bond transactions" ON public.bond_transactions;
CREATE POLICY "Users can insert their own bond transactions" ON public.bond_transactions
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- 10. public.net_worth_snapshots
DROP POLICY IF EXISTS "Users can view their own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can view their own net worth snapshots" ON public.net_worth_snapshots
    FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can insert their own net worth snapshots" ON public.net_worth_snapshots
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can update their own net worth snapshots" ON public.net_worth_snapshots
    FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own net worth snapshots" ON public.net_worth_snapshots;
CREATE POLICY "Users can delete their own net worth snapshots" ON public.net_worth_snapshots
    FOR DELETE USING ((select auth.uid()) = user_id);
