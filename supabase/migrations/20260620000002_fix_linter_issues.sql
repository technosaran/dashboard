-- 1. Security Fixes: Set search_path and Security Invoker
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.get_summary_v1() SECURITY INVOKER;

-- 2. Performance: Drop Duplicate Indexes
DROP INDEX IF EXISTS public.idx_bond_txns_user_date;
DROP INDEX IF EXISTS public.idx_forex_trades_forex_account_id;
DROP INDEX IF EXISTS public.idx_stock_trades_user_trade_date;

-- 3. Performance: Drop Unused Indexes
DROP INDEX IF EXISTS public.idx_transactions_source_id;
DROP INDEX IF EXISTS public.idx_transactions_ledger_log_id;
DROP INDEX IF EXISTS public.idx_accounts_user_name;
DROP INDEX IF EXISTS public.idx_goals_user_created;
DROP INDEX IF EXISTS public.idx_stock_trades_user_date;
DROP INDEX IF EXISTS public.idx_stock_trades_ledger_log_id;
DROP INDEX IF EXISTS public.idx_expenses_recurring;
DROP INDEX IF EXISTS public.idx_stock_trades_symbol;
DROP INDEX IF EXISTS public.idx_ledger_logs_source_id;
DROP INDEX IF EXISTS public.idx_fno_trades_close_ledger_log_id;
DROP INDEX IF EXISTS public.idx_fno_trades_ledger_log_id;
DROP INDEX IF EXISTS public.idx_transfers_user_created;
DROP INDEX IF EXISTS public.idx_profiles_username;
DROP INDEX IF EXISTS public.idx_accounts_user_balance;
DROP INDEX IF EXISTS public.idx_goals_user_deadline;

-- 4. Performance: Consolidate Multiple Permissive Policies
-- Drop the redundant "Users can view their own mf trades" (SELECT) policy
DROP POLICY IF EXISTS "Users can view their own mf trades" ON public.mutual_fund_trades;

-- Drop the redundant profile SELECT policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Drop the redundant profile UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
