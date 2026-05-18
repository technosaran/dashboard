-- Migration: 20260515210000_fix_remaining_linter_errors.sql
-- Purpose: Set search_path = public for any remaining legacy SECURITY DEFINER functions dynamically

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure AS sig 
        FROM pg_proc 
        WHERE proname IN ('initialize_goal', 'process_transfer', 'record_expense', 'record_income', 'record_investment')
    ) LOOP
        EXECUTE 'ALTER FUNCTION ' || r.sig || ' SET search_path = public;';
    END LOOP;
END $$;
