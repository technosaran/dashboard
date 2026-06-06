-- Migration: Fix Ledger Immutability RPC Updates
-- Purpose: Prevent database function updates on ledger_logs BEFORE trigger protection runs.
-- Instead of doing an UPDATE on ledger_logs after creating a transaction/source entity,
-- we pre-generate UUIDs for both the transaction and ledger log so they can refer to each other
-- and be inserted directly without any UPDATE.

CREATE OR REPLACE FUNCTION process_family_transfer(
    p_user_id UUID,
    p_account_id UUID,
    p_recipient_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_bal NUMERIC; 
    v_acc_name TEXT; 
    v_rec_name TEXT; 
    v_txn_id UUID; 
    v_details TEXT; 
    v_log_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    IF p_amount <= 0 THEN 
        RAISE EXCEPTION 'Amount must be positive'; 
    END IF;

    SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Account not found'; 
    END IF;
    IF v_old_bal < p_amount THEN 
        RAISE EXCEPTION 'Insufficient balance'; 
    END IF;

    SELECT name INTO v_rec_name FROM recipients WHERE id = p_recipient_id AND user_id = p_user_id;
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Recipient not found'; 
    END IF;

    UPDATE accounts SET balance = balance - p_amount WHERE id = p_account_id;
    v_details := 'Sent money to ' || v_rec_name || COALESCE(': ' || p_note, '');
    
    -- Pre-generate IDs to avoid doing an UPDATE on ledger_logs which triggers the immutability trigger
    v_txn_id := gen_random_uuid();
    v_log_id := gen_random_uuid();

    INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES (v_log_id, p_user_id, p_account_id, v_acc_name, 'SEND_MONEY', p_amount, v_old_bal, v_old_bal - p_amount, v_details, v_txn_id, 'transaction');

    INSERT INTO transactions (id, user_id, account_id, description, amount, type, category, date, ledger_log_id)
    VALUES (v_txn_id, p_user_id, p_account_id, v_details, p_amount, 'expense', 'Family & Friends', CURRENT_DATE, v_log_id);

    RETURN jsonb_build_object('success', true, 'transaction_id', v_txn_id, 'new_balance', v_old_bal - p_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION adjust_account_balance(
    p_user_id UUID,
    p_account_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT 'Manual balance adjustment',
    p_source_id UUID DEFAULT NULL,
    p_source_type TEXT DEFAULT 'transaction'
) RETURNS JSONB AS $$
DECLARE 
    v_old_bal NUMERIC; 
    v_acc_name TEXT; 
    v_txn_id UUID; 
    v_log_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN 
        RAISE EXCEPTION 'Account not found'; 
    END IF;

    UPDATE accounts SET balance = balance + p_amount WHERE id = p_account_id;
    
    v_log_id := gen_random_uuid();
    
    IF p_source_id IS NULL THEN
        -- Pre-generate transaction ID to avoid doing an UPDATE on ledger_logs later
        v_txn_id := gen_random_uuid();
        
        INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (v_log_id, p_user_id, p_account_id, v_acc_name, CASE WHEN p_amount >= 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END, ABS(p_amount), v_old_bal, v_old_bal + p_amount, COALESCE(p_note, 'Manual adjustment'), v_txn_id, p_source_type);

        INSERT INTO transactions (id, user_id, account_id, description, amount, type, category, date, ledger_log_id)
        VALUES (v_txn_id, p_user_id, p_account_id, COALESCE(p_note, 'Balance adjustment'), ABS(p_amount), CASE WHEN p_amount >= 0 THEN 'income' ELSE 'expense' END, 'Adjustments', CURRENT_DATE, v_log_id);
    ELSE
        INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (v_log_id, p_user_id, p_account_id, v_acc_name, CASE WHEN p_amount >= 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END, ABS(p_amount), v_old_bal, v_old_bal + p_amount, COALESCE(p_note, 'Manual adjustment'), p_source_id, p_source_type);

        INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, ledger_log_id)
        VALUES (p_user_id, p_account_id, COALESCE(p_note, 'Balance adjustment'), ABS(p_amount), CASE WHEN p_amount >= 0 THEN 'income' ELSE 'expense' END, 'Adjustments', CURRENT_DATE, v_log_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'new_balance', v_old_bal + p_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
