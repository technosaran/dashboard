-- Enable Row Level Security (RLS) on all user data tables
-- Implements task 1.8: Row-Level Security policies in Supabase

DO $$
DECLARE
  tables text[] := ARRAY[
    'profiles', 'accounts', 'transactions', 'transfers', 'ledger_logs',
    'incomes', 'expenses', 'budgets', 'goals', 'liabilities',
    'investments', 'stock_trades', 'mutual_funds', 'mutual_fund_trades',
    'bonds', 'bond_transactions', 'alternative_assets', 'forex_accounts',
    'forex_trades', 'forex_transactions', 'fno_trades', 'family_members',
    'family_allowances', 'family_transfers'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Policy creation wrapper to make them idempotent
CREATE OR REPLACE FUNCTION public.create_policy_if_not_exists(
  policy_name text,
  table_name text,
  cmd text,
  using_expr text,
  with_check_expr text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = table_name AND policyname = policy_name
  ) THEN
    IF cmd = 'INSERT' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (%s);', 
        policy_name, table_name, COALESCE(with_check_expr, using_expr));
    ELSIF with_check_expr IS NOT NULL THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s USING (%s) WITH CHECK (%s);', 
        policy_name, table_name, cmd, using_expr, with_check_expr);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR %s USING (%s);', 
        policy_name, table_name, cmd, using_expr);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Profiles (id matches auth.uid())
SELECT public.create_policy_if_not_exists('profiles_select', 'profiles', 'SELECT', 'id = auth.uid()');
SELECT public.create_policy_if_not_exists('profiles_insert', 'profiles', 'INSERT', 'true', 'id = auth.uid()');
SELECT public.create_policy_if_not_exists('profiles_update', 'profiles', 'UPDATE', 'id = auth.uid()', 'id = auth.uid()');
SELECT public.create_policy_if_not_exists('profiles_delete', 'profiles', 'DELETE', 'id = auth.uid()');

-- Helper macro function to generate standard policies for user_id tables
DO $$
DECLARE
  tables text[] := ARRAY[
    'accounts', 'transactions', 'transfers', 'ledger_logs',
    'incomes', 'expenses', 'budgets', 'goals', 'liabilities',
    'investments', 'stock_trades', 'mutual_funds', 'mutual_fund_trades',
    'bonds', 'bond_transactions', 'alternative_assets', 'forex_accounts',
    'forex_trades', 'forex_transactions', 'fno_trades', 'family_members',
    'family_allowances', 'family_transfers'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    PERFORM public.create_policy_if_not_exists(t || '_select', t, 'SELECT', 'user_id = auth.uid()');
    PERFORM public.create_policy_if_not_exists(t || '_insert', t, 'INSERT', 'true', 'user_id = auth.uid()');
    PERFORM public.create_policy_if_not_exists(t || '_update', t, 'UPDATE', 'user_id = auth.uid()', 'user_id = auth.uid()');
    PERFORM public.create_policy_if_not_exists(t || '_delete', t, 'DELETE', 'user_id = auth.uid()');
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.create_policy_if_not_exists(text, text, text, text, text);
