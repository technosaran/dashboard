-- RPC for atomic transfer processing with deep ledger linking
CREATE OR REPLACE FUNCTION process_transfer(
    p_user_id UUID,
    p_from_account_id UUID,
    p_to_account_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_from_balance NUMERIC;
    v_to_balance NUMERIC;
    v_from_name TEXT;
    v_to_name TEXT;
    v_from_currency TEXT;
    v_to_currency TEXT;
    v_transfer_id UUID;
BEGIN
    -- 1. Validate accounts and lock them
    SELECT balance, name, currency INTO v_from_balance, v_from_name, v_from_currency
    FROM accounts WHERE id = p_from_account_id AND user_id = p_user_id FOR UPDATE;
    
    SELECT balance, name, currency INTO v_to_balance, v_to_name, v_to_currency
    FROM accounts WHERE id = p_to_account_id AND user_id = p_user_id FOR UPDATE;

    IF v_from_name IS NULL OR v_to_name IS NULL THEN
        RAISE EXCEPTION 'One or more accounts not found';
    END IF;

    IF v_from_currency != v_to_currency THEN
        RAISE EXCEPTION 'Currency mismatch: % and %', v_from_currency, v_to_currency;
    END IF;

    IF v_from_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance in %', v_from_name;
    END IF;

    -- 2. Execute Transfer
    v_from_balance := v_from_balance - p_amount;
    v_to_balance := v_to_balance + p_amount;

    UPDATE accounts SET balance = v_from_balance WHERE id = p_from_account_id;
    UPDATE accounts SET balance = v_to_balance WHERE id = p_to_account_id;

    -- Create Transfer record
    INSERT INTO transfers (
        user_id, from_account_id, to_account_id, amount, note
    ) VALUES (
        p_user_id, p_from_account_id, p_to_account_id, p_amount, p_note
    ) RETURNING id INTO v_transfer_id;

    -- 3. Log to Ledger (Two entries)
    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_id, source_type
    ) VALUES (
        p_user_id, p_from_account_id, v_from_name, 'TRANSFER_OUT', 
        p_amount, v_from_balance + p_amount, v_from_balance, 
        'Transfer to ' || v_to_name || CASE WHEN p_note IS NOT NULL THEN ': ' || p_note ELSE '' END,
        v_transfer_id, 'transfer'
    );

    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_id, source_type
    ) VALUES (
        p_user_id, p_to_account_id, v_to_name, 'TRANSFER_IN', 
        p_amount, v_to_balance - p_amount, v_to_balance, 
        'Transfer from ' || v_from_name || CASE WHEN p_note IS NOT NULL THEN ': ' || p_note ELSE '' END,
        v_transfer_id, 'transfer'
    );

    RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
