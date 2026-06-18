-- Migration: Fix adjust_account_balance immutability violation
-- Date: 2026-06-18
-- Purpose: Pre-generate IDs to avoid updating ledger_logs, bypassing the BEFORE UPDATE immutability check.

CREATE OR REPLACE FUNCTION public.adjust_account_balance(
    p_user_id UUID,
    p_account_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT 'Manual balance adjustment',
    p_source_id UUID DEFAULT NULL,
    p_source_type TEXT DEFAULT 'transaction'
) RETURNS JSONB AS $$
DECLARE 
    v_old_bal NUMERIC; 
    v_acc_name TEXT; 
    v_txn_id UUID; 
    v_log_id UUID;
    v_final_source_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Account not found'; 
    END IF;

    UPDATE accounts SET balance = balance + p_amount WHERE id = p_account_id;
    
    v_log_id := gen_random_uuid();
    v_txn_id := gen_random_uuid();
    v_final_source_id := COALESCE(p_source_id, v_txn_id);
    
    INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES (
        v_log_id, 
        p_user_id, 
        p_account_id, 
        v_acc_name, 
        CASE WHEN p_amount >= 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END, 
        ABS(p_amount), 
        v_old_bal, 
        v_old_bal + p_amount, 
        COALESCE(p_note, 'Manual adjustment'), 
        v_final_source_id, 
        COALESCE(p_source_type, 'transaction')
    );

    INSERT INTO transactions (id, user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
    VALUES (
        v_txn_id, 
        p_user_id, 
        p_account_id, 
        COALESCE(p_note, 'Balance adjustment'), 
        ABS(p_amount), 
        CASE WHEN p_amount >= 0 THEN 'income' ELSE 'expense' END, 
        'Adjustments', 
        CURRENT_DATE, 
        v_final_source_id, 
        COALESCE(p_source_type, 'transaction'), 
        v_log_id
    );

    RETURN jsonb_build_object('success', true, 'new_balance', v_old_bal + p_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Standardize security permissions
REVOKE EXECUTE ON FUNCTION public.adjust_account_balance(UUID, UUID, NUMERIC, TEXT, UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.adjust_account_balance(UUID, UUID, NUMERIC, TEXT, UUID, TEXT) TO authenticated, service_role;
