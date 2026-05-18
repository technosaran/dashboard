-- Migration: 20260515200000_fix_linter_errors_dynamically.sql
-- Purpose: Set search_path = public for any remaining legacy SECURITY DEFINER functions dynamically

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure AS sig 
        FROM pg_proc 
        WHERE proname IN ('delete_account_v2', 'record_mf_investment_v3', 'create_account_atomic', 'revert_ledger_log')
    ) LOOP
        EXECUTE 'ALTER FUNCTION ' || r.sig || ' SET search_path = public;';
    END LOOP;
END $$;
