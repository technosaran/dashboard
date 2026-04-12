
-- RPC function to process family transfers atomically
CREATE OR REPLACE FUNCTION process_family_transfer(
    p_user_id UUID,
    p_account_id UUID,
    p_recipient_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_recipient_name TEXT;
    v_transaction_id UUID;
    v_details TEXT;
BEGIN
    -- 1. Lock and validate account
    SELECT balance, name INTO v_old_balance, v_account_name
    FROM accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found';
    END IF;

    IF v_old_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- 2. Validate recipient
    SELECT name INTO v_recipient_name
    FROM recipients
    WHERE id = p_recipient_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recipient not found';
    END IF;

    -- 3. Execute deduction
    v_new_balance := v_old_balance - p_amount;
    UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

    -- 4. Create Transaction record (the primary source)
    v_details := 'Sent money to ' || v_recipient_name || CASE WHEN p_note IS NOT NULL AND p_note != '' THEN ': ' || p_note ELSE '' END;
    
    INSERT INTO transactions (
        user_id, account_id, description, amount, type, category, date
    ) VALUES (
        p_user_id, p_account_id, v_details, p_amount, 'expense', 'Family & Friends', CURRENT_DATE
    ) RETURNING id INTO v_transaction_id;

    -- 5. Log to Ledger (linking to the transaction)
    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_id, source_type
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 'SEND_MONEY', 
        p_amount, v_old_balance, v_new_balance, v_details,
        v_transaction_id, 'transaction'
    );

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'new_balance', v_new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
