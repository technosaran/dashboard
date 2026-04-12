-- Migration: Atomic Account Operations
-- Purpose: Consolidate account creation, deletion, and adjustment into atomic RPCs for data integrity

-- 1. Atomic Balance Adjustment
CREATE OR REPLACE FUNCTION adjust_account_balance(
    p_user_id UUID,
    p_account_id UUID,
    p_amount NUMERIC,
    p_note TEXT
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_transaction_id UUID;
BEGIN
    -- Lock account
    SELECT balance, name INTO v_old_balance, v_account_name
    FROM accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found';
    END IF;

    v_new_balance := v_old_balance + p_amount;
    
    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Update balance
    UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

    -- Create Transaction record
    INSERT INTO transactions (
        user_id, account_id, description, amount, type, date
    ) VALUES (
        p_user_id, p_account_id, COALESCE(p_note, 'Balance adjustment'), ABS(p_amount), 
        CASE WHEN p_amount > 0 THEN 'income' ELSE 'expense' END,
        CURRENT_DATE
    ) RETURNING id INTO v_transaction_id;

    -- Log to Ledger
    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_id, source_type
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 
        CASE WHEN p_amount > 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
        ABS(p_amount), v_old_balance, v_new_balance, 
        COALESCE(p_note, 'Manual balance adjustment'),
        v_transaction_id, 'transaction'
    );

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atomic Account Creation
CREATE OR REPLACE FUNCTION create_account_atomic(
    p_user_id UUID,
    p_name TEXT,
    p_type TEXT,
    p_balance NUMERIC,
    p_color TEXT DEFAULT NULL,
    p_institution TEXT DEFAULT NULL,
    p_account_number TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_account_id UUID;
BEGIN
    INSERT INTO accounts (
        user_id, name, type, balance, color, institution, account_number
    ) VALUES (
        p_user_id, p_name, p_type, p_balance, p_color, p_institution, p_account_number
    ) RETURNING id INTO v_account_id;

    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details
    ) VALUES (
        p_user_id, v_account_id, p_name, 'CREATE',
        p_balance, 0, p_balance,
        'Created new ' || p_type || ' account: ' || p_name
    );

    RETURN jsonb_build_object('success', true, 'id', v_account_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atomic Account Deletion (with Snapshot for undo)
CREATE OR REPLACE FUNCTION delete_account_atomic(
    p_user_id UUID,
    p_account_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_account RECORD;
BEGIN
    -- Get snapshot
    SELECT * INTO v_account FROM accounts WHERE id = p_account_id AND user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account not found');
    END IF;

    -- Delete (linked records should be handled by ON DELETE CASCADE or SET NULL)
    DELETE FROM accounts WHERE id = p_account_id;

    -- Log deletion with metadata
    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        metadata
    ) VALUES (
        p_user_id, p_account_id, v_account.name, 'DELETE',
        v_account.balance, v_account.balance, 0,
        'Deleted account: ' || v_account.name,
        to_jsonb(v_account)
    );

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
