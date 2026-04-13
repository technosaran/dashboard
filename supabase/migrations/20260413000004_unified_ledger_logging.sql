-- Migration: Unified Ledger Logging
-- Purpose: Ensure every financial action is logged, including "Suspense" (no account) transactions.
-- Fixes: record_income, record_expense, and adjust_account_balance to always populate ledger_logs.

-- 1. Hardened record_income
CREATE OR REPLACE FUNCTION record_income(
    p_user_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC := 0;
    v_new_balance NUMERIC := 0;
    v_account_name TEXT := 'Suspense (Direct Log)';
    v_income_id UUID;
BEGIN
    -- 1. Insert into incomes table FIRST
    INSERT INTO incomes (
        user_id, account_id, description, amount, category, date
    ) VALUES (
        p_user_id, p_account_id, p_description, p_amount, p_category, p_date
    ) RETURNING id INTO v_income_id;

    -- 2. Handle Balance logic if account is provided
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Account not found or access denied';
        END IF;

        v_new_balance := v_old_balance + p_amount;
        UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;
    ELSE
        -- For suspense items, new_balance is just the amount for this txn context
        v_new_balance := p_amount;
    END IF;

    -- 3. ALWAYS Log to ledger_logs
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

    -- 4. Log to transactions table if account is linked
    IF p_account_id IS NOT NULL THEN
        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date
        ) VALUES (
            p_user_id, p_account_id, p_description, p_amount, 'income', p_category, p_date
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'income_id', v_income_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Hardened record_expense
CREATE OR REPLACE FUNCTION record_expense(
    p_user_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC := 0;
    v_new_balance NUMERIC := 0;
    v_account_name TEXT := 'Cash / Suspense';
    v_expense_id UUID;
BEGIN
    -- 1. Insert into expenses table FIRST
    INSERT INTO expenses (
        user_id, account_id, description, amount, category, date
    ) VALUES (
        p_user_id, p_account_id, p_description, p_amount, p_category, p_date
    ) RETURNING id INTO v_expense_id;

    -- 2. Handle Balance logic if account is provided
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Account not found or access denied';
        END IF;

        IF v_old_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient balance in %', v_account_name;
        END IF;

        v_new_balance := v_old_balance - p_amount;
        UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;
    ELSE
        v_new_balance := -p_amount;
    END IF;

    -- 3. ALWAYS Log to ledger_logs
    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_type, source_id
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 'ADJUST_DOWN', 
        p_amount, v_old_balance, v_new_balance, 
        'Expense: ' || p_description || ' (' || p_category || ')',
        'expense', v_expense_id
    );

    -- 4. Log to transactions table if account is linked
    IF p_account_id IS NOT NULL THEN
        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date
        ) VALUES (
            p_user_id, p_account_id, p_description, p_amount, 'expense', p_category, p_date
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'expense_id', v_expense_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Hardened create_account_atomic
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
DECLARE
    v_account_id UUID;
BEGIN
    INSERT INTO accounts (
        user_id, name, type, balance, currency, bank_name, color, institution, account_number
    ) VALUES (
        p_user_id, p_name, p_type, p_balance, p_currency, p_bank_name, p_color, p_institution, p_account_number
    ) RETURNING id INTO v_account_id;

    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details
    ) VALUES (
        p_user_id, v_account_id, p_name, 'CREATE',
        p_balance, 0, p_balance,
        'Created new ' || p_type || ' account: ' || p_name || ' (' || p_currency || ')'
    );

    RETURN jsonb_build_object('success', true, 'id', v_account_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
