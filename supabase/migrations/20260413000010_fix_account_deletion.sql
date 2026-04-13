-- Migration: Fix Account Deletion RPC
-- Purpose: Address schema cache issues by providing a super-robust deletion RPC with explicit parameter handling.

CREATE OR REPLACE FUNCTION delete_account_atomic_v2(
    p_user_id UUID,
    p_account_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_account RECORD;
BEGIN
    -- 1. Get snapshot and lock
    SELECT * INTO v_account FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account not found or access denied');
    END IF;

    -- 2. Delete
    DELETE FROM accounts WHERE id = p_account_id;

    -- 3. Log deletion with metadata
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
