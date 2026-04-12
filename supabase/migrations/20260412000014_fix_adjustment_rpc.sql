-- Migration: Final RPC Fixes
-- Purpose: Re-declare atomic balance adjustment with robust types and defaults to fix schema cache resolution issues

CREATE OR REPLACE FUNCTION public.adjust_account_balance(
    p_user_id UUID,
    p_account_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT 'Manual balance adjustment'
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_transaction_id UUID;
BEGIN
    -- 1. Authorization & Lock
    SELECT balance, name INTO v_old_balance, v_account_name
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account not found or access denied');
    END IF;

    -- 2. Calculate
    v_new_balance := v_old_balance + p_amount;
    
    -- Prevent negative balance if enforced (Business Logic)
    -- IF v_new_balance < 0 THEN
    --     RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds for this adjustment');
    -- END IF;

    -- 3. Execute
    UPDATE public.accounts SET balance = v_new_balance WHERE id = p_account_id;

    -- 4. Audit Trail (Transaction)
    INSERT INTO public.transactions (
        user_id, account_id, description, amount, type, date
    ) VALUES (
        p_user_id, p_account_id, COALESCE(p_note, 'Balance adjustment'), ABS(p_amount), 
        CASE WHEN p_amount >= 0 THEN 'income' ELSE 'expense' END,
        CURRENT_DATE
    ) RETURNING id INTO v_transaction_id;

    -- 5. Ledger Logging
    INSERT INTO public.ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_id, source_type
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 
        CASE WHEN p_amount >= 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
        ABS(p_amount), v_old_balance, v_new_balance, 
        COALESCE(p_note, 'Manual balance adjustment'),
        v_transaction_id, 'transaction'
    );

    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
