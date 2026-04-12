-- Fix record_income to properly link ledger_logs to income records
CREATE OR REPLACE FUNCTION record_income(
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
    v_income_id UUID;
BEGIN
    -- 1. Insert into incomes table FIRST to get the ID
    INSERT INTO incomes (
        user_id, account_id, description, amount, category, date
    ) VALUES (
        p_user_id, p_account_id, p_description, p_amount, p_category, p_date
    ) RETURNING id INTO v_income_id;

    -- 2. If account is provided, handle balance increment and LOGGING
    IF p_account_id IS NOT NULL THEN
        -- Lock the account row for update to prevent race conditions
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Account not found or access denied';
        END IF;

        v_new_balance := v_old_balance + p_amount;

        -- Update balance
        UPDATE accounts 
        SET balance = v_new_balance
        WHERE id = p_account_id;

        -- Log to ledger_logs WITH source linkage
        INSERT INTO ledger_logs (
            user_id, account_id, account_name, action_type, 
            amount, previous_balance, new_balance, details,
            source_type, source_id
        ) VALUES (
            p_user_id, p_account_id, v_account_name, 'ADJUST_UP', 
            p_amount, v_old_balance, v_new_balance, 
            'Income: ' || p_description || ' (' || p_category || ')',
            'income', v_income_id
        );

        -- Log to transactions table (Core account history)
        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date
        ) VALUES (
            p_user_id, p_account_id, p_description, p_amount, 'income', p_category, p_date
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'income_id', v_income_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- HEALING: Link existing orphaned records
UPDATE ledger_logs l
SET source_id = i.id, source_type = 'income'
FROM incomes i
WHERE l.source_id IS NULL 
  AND l.action_type = 'ADJUST_UP'
  AND l.user_id = i.user_id
  AND l.account_id = i.account_id
  AND l.amount = i.amount
  AND (l.details LIKE '%' || i.description || '%' OR i.description LIKE '%' || l.details || '%');
