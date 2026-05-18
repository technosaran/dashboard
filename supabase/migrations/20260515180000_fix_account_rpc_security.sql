-- Migration: 20260515180000_fix_account_rpc_security.sql
-- Purpose: Ensures SECURITY DEFINER functions have explicit search_path = public to prevent "relation does not exist" errors,
-- and drops obsolete overloaded functions.

-- Drop the old v3 function that is no longer used and lacked search_path
DROP FUNCTION IF EXISTS public.record_mf_investment_v3(UUID, TEXT, TEXT, DATE, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT, INTEGER);

-- Recreate the fully-featured create_account_atomic with search_path = public to override any broken old versions
CREATE OR REPLACE FUNCTION create_account_atomic(
    p_user_id UUID, 
    p_name TEXT, 
    p_type TEXT, 
    p_balance NUMERIC, 
    p_currency TEXT DEFAULT 'INR',
    p_bank_name TEXT DEFAULT NULL,
    p_color TEXT DEFAULT NULL, 
    p_institution TEXT DEFAULT NULL, 
    p_account_number TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE v_acc_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    
    INSERT INTO accounts (user_id, name, type, balance, currency, bank_name, color, institution, account_number)
    VALUES (p_user_id, p_name, p_type, p_balance, p_currency, p_bank_name, p_color, p_institution, p_account_number) 
    RETURNING id INTO v_acc_id;
    
    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
    VALUES (p_user_id, v_acc_id, p_name, 'CREATE', p_balance, 0, p_balance, 'Created ' || p_type || ' account: ' || p_name);
    
    RETURN jsonb_build_object('success', true, 'id', v_acc_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- For backwards compatibility, re-declare the simplified version as well, with search_path = public
CREATE OR REPLACE FUNCTION create_account_atomic(
    p_user_id UUID, 
    p_name TEXT, 
    p_type TEXT, 
    p_balance NUMERIC, 
    p_color TEXT DEFAULT NULL, 
    p_institution TEXT DEFAULT NULL, 
    p_account_number TEXT DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
    -- Just call the fully-featured one
    RETURN create_account_atomic(p_user_id, p_name, p_type, p_balance, 'INR', NULL, p_color, p_institution, p_account_number);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
