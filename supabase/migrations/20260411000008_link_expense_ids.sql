CREATE OR REPLACE FUNCTION record_expense(
    p_user_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_expense_id UUID;
    v_transaction_id UUID;
BEGIN
    -- 1. Create the expense record first so we have the ID
    INSERT INTO expenses (
        user_id, account_id, description, amount, category, date
    ) VALUES (
        p_user_id, p_account_id, p_description, p_amount, p_category, p_date
    ) RETURNING id INTO v_expense_id;

    -- 2. Handle Account-Linked Expense (Balance Deduction)
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Account not found or access denied';
        END IF;

        IF v_old_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient balance in account %', v_account_name;
        END IF;

        v_new_balance := v_old_balance - p_amount;

        UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

        -- Create Transaction record and get ID
        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date
        ) VALUES (
            p_user_id, p_account_id, p_description, p_amount, 'expense', p_category, p_date
        ) RETURNING id INTO v_transaction_id;

        -- MANDATORY LEDGER LOG (Financial Impact)
        INSERT INTO ledger_logs (
            user_id, account_id, account_name, action_type, 
            amount, previous_balance, new_balance, details,
            source_id, source_type
        ) VALUES (
            p_user_id, p_account_id, v_account_name, 'ADJUST_DOWN', 
            p_amount, v_old_balance, v_new_balance, 
            'Expense (Deducted): ' || p_description || ' [' || p_category || ']',
            v_expense_id, 'expense'
        );
    ELSE
        -- Manual Log
        INSERT INTO ledger_logs (
            user_id, action_type, amount, details, source_id, source_type
        ) VALUES (
            p_user_id, 'LOG_ONLY', p_amount, 
            'Manual Expense (No Deduction): ' || p_description || ' [' || p_category || ']',
            v_expense_id, 'expense'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'expense_id', v_expense_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
