-- Migration: Support cross-currency transfers with conversion tracking
-- Purpose: Allows transferring between accounts of different currencies, capturing the manually entered converted amount and exchange rate.

DROP FUNCTION IF EXISTS public.process_transfer(UUID, UUID, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.process_transfer(UUID, UUID, UUID, NUMERIC, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.process_transfer(
    p_user_id UUID,
    p_from_account_id UUID,
    p_to_account_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT NULL,
    p_converted_amount NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_from_balance NUMERIC;
    v_to_balance NUMERIC;
    v_from_name TEXT;
    v_to_name TEXT;
    v_from_currency TEXT;
    v_to_currency TEXT;
    v_transfer_id UUID;
    v_target_amount NUMERIC;
    v_rate NUMERIC;
    v_details_suffix TEXT := '';
BEGIN
    -- SECURITY: Identity Verification
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- VALIDATION: Amounts & Accounts
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Transfer amount must be positive'; END IF;
    IF p_from_account_id = p_to_account_id THEN RAISE EXCEPTION 'Self-transfers blocked'; END IF;

    -- Locking & Parity
    SELECT balance, name, currency INTO v_from_balance, v_from_name, v_from_currency
    FROM accounts WHERE id = p_from_account_id AND user_id = p_user_id FOR UPDATE;
    
    SELECT balance, name, currency INTO v_to_balance, v_to_name, v_to_currency
    FROM accounts WHERE id = p_to_account_id AND user_id = p_user_id FOR UPDATE;

    IF v_from_name IS NULL OR v_to_name IS NULL THEN RAISE EXCEPTION 'Accounts not found'; END IF;

    -- Handle Multi-Currency Conversion
    IF v_from_currency = v_to_currency THEN
        v_target_amount := p_amount;
    ELSE
        IF p_converted_amount IS NULL OR p_converted_amount <= 0 THEN
            RAISE EXCEPTION 'Converted amount is required and must be positive for cross-currency transfers';
        END IF;
        v_target_amount := p_converted_amount;
        v_rate := ROUND(v_target_amount / p_amount, 4);
        v_details_suffix := ' (Ex. Rate: 1 ' || v_from_currency || ' = ' || v_rate || ' ' || v_to_currency || ')';
    END IF;

    IF v_from_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance in %', v_from_name; END IF;

    UPDATE accounts SET balance = balance - p_amount WHERE id = p_from_account_id;
    UPDATE accounts SET balance = balance + v_target_amount WHERE id = p_to_account_id;

    INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, note)
    VALUES (p_user_id, p_from_account_id, p_to_account_id, p_amount, COALESCE(p_note, '') || v_details_suffix) 
    RETURNING id INTO v_transfer_id;

    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES 
    (p_user_id, p_from_account_id, v_from_name, 'TRANSFER_OUT', p_amount, v_from_balance, v_from_balance - p_amount, 'To ' || v_to_name || v_details_suffix || COALESCE(': ' || p_note, ''), v_transfer_id, 'transfer'),
    (p_user_id, p_to_account_id, v_to_name, 'TRANSFER_IN', v_target_amount, v_to_balance, v_to_balance + v_target_amount, 'From ' || v_from_name || v_details_suffix || COALESCE(': ' || p_note, ''), v_transfer_id, 'transfer');

    RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.process_transfer(UUID, UUID, UUID, NUMERIC, TEXT, NUMERIC) TO authenticated;
