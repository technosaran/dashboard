-- Migration: Atomic Goal Initialization
-- Purpose: Support creating a goal with an initial contribution from an account.

CREATE OR REPLACE FUNCTION initialize_goal(
    p_user_id UUID,
    p_name TEXT,
    p_target_amount NUMERIC,
    p_initial_amount NUMERIC,
    p_deadline DATE,
    p_category TEXT,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_goal_id UUID;
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_log_id UUID;
BEGIN
    -- 1. Deduct from account if initial_amount > 0 and account is provided
    IF p_initial_amount > 0 AND p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
        IF v_old_balance < p_initial_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

        v_new_balance := v_old_balance - p_initial_amount;
        UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;
    END IF;

    -- 2. Create the Goal
    INSERT INTO goals (
        user_id, name, target_amount, current_amount, deadline, category
    ) VALUES (
        p_user_id, p_name, p_target_amount, p_initial_amount, p_deadline, p_category
    ) RETURNING id INTO v_goal_id;

    -- 3. Log to Ledger if account was used
    IF p_initial_amount > 0 AND p_account_id IS NOT NULL THEN
        INSERT INTO ledger_logs (
            user_id, account_id, account_name, action_type, 
            amount, previous_balance, new_balance, details,
            source_id, source_type
        ) VALUES (
            p_user_id, p_account_id, v_account_name, 'ADJUST_DOWN', 
            p_initial_amount, v_old_balance, v_new_balance, 
            'Initial Contribution to ' || p_name,
            v_goal_id, 'goal'
        ) RETURNING id INTO v_log_id;

        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date,
            source_id, source_type, ledger_log_id
        ) VALUES (
            p_user_id, p_account_id, 'Goal Setup: ' || p_name, p_initial_amount, 'expense', 'Goals', CURRENT_DATE,
            v_goal_id, 'goal', v_log_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'goal_id', v_goal_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
