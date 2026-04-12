
-- Add metadata column to ledger_logs to store snapshots for undo/redo
ALTER TABLE public.ledger_logs ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Update revert_ledger_log to support undoing 'DELETE' actions
CREATE OR REPLACE FUNCTION revert_ledger_log(
    p_log_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_log RECORD;
    v_other_log RECORD;
    v_current_balance NUMERIC;
    v_rev_amount NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- 1. Fetch log and lock it
    SELECT * INTO v_log FROM ledger_logs 
    WHERE id = p_log_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Log entry not found or access denied');
    END IF;

    -- 2. Handle Transfer Reversal (Reverts BOTH sides)
    IF v_log.source_type = 'transfer' AND v_log.source_id IS NOT NULL THEN
        -- Find both logs for this transfer
        FOR v_other_log IN SELECT * FROM ledger_logs WHERE source_id = v_log.source_id AND source_type = 'transfer' AND user_id = p_user_id LOOP
            -- Revert each side
            SELECT balance INTO v_current_balance FROM accounts WHERE id = v_other_log.account_id AND user_id = p_user_id FOR UPDATE;
            
            IF v_other_log.action_type = 'TRANSFER_OUT' THEN
                v_rev_amount := v_other_log.amount; -- Restore deduction
            ELSE
                v_rev_amount := -v_other_log.amount; -- Reverse credit
            END IF;

            v_new_balance := v_current_balance + v_rev_amount;
            UPDATE accounts SET balance = v_new_balance WHERE id = v_other_log.account_id;
        END LOOP;

        -- Cleanup source tables
        DELETE FROM transfers WHERE id = v_log.source_id AND user_id = p_user_id;
        DELETE FROM ledger_logs WHERE source_id = v_log.source_id AND source_type = 'transfer' AND user_id = p_user_id;

        RETURN jsonb_build_object('success', true);
    END IF;

    -- 3. Handle Single Log Reversal
    
    -- A. Handle Account Deletion Reversal (UNDELETE)
    IF v_log.action_type = 'DELETE' AND v_log.metadata IS NOT NULL THEN
        INSERT INTO accounts (
            id, user_id, name, type, balance, currency, bank_name, bank_logo, created_at
        ) VALUES (
            (v_log.metadata->>'id')::UUID,
            (v_log.metadata->>'user_id')::UUID,
            v_log.metadata->>'name',
            v_log.metadata->>'type',
            (v_log.metadata->>'balance')::NUMERIC,
            v_log.metadata->>'currency',
            v_log.metadata->>'bank_name',
            v_log.metadata->>'bank_logo',
            (v_log.metadata->>'created_at')::TIMESTAMPTZ
        );
        -- Cleanup log
        DELETE FROM ledger_logs WHERE id = p_log_id;
        RETURN jsonb_build_object('success', true);
    END IF;

    -- B. Handle Account Creation Reversal
    IF v_log.action_type = 'CREATE' THEN
        DELETE FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id;
        DELETE FROM ledger_logs WHERE id = p_log_id;
        RETURN jsonb_build_object('success', true);
    END IF;

    -- C. Handle Financial Reversals
    IF v_log.account_id IS NOT NULL AND v_log.amount IS NOT NULL THEN
        SELECT balance INTO v_current_balance FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;

        IF FOUND THEN
            IF v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY') THEN
                v_rev_amount := v_log.amount;
            ELSIF v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN') THEN
                v_rev_amount := -v_log.amount;
            ELSE
                v_rev_amount := 0;
            END IF;

            IF v_rev_amount != 0 THEN
                v_new_balance := v_current_balance + v_rev_amount;
                UPDATE accounts SET balance = v_new_balance WHERE id = v_log.account_id;
            END IF;
        END IF;
    END IF;

    -- 4. Deep Cleanup for individual sources (Expenses, Transactions)
    IF v_log.source_id IS NOT NULL THEN
        IF v_log.source_type = 'expense' THEN
            DELETE FROM expenses WHERE id = v_log.source_id AND user_id = p_user_id;
            DELETE FROM transactions WHERE account_id = v_log.account_id AND amount = v_log.amount AND user_id = p_user_id AND (description LIKE '%' || v_log.details || '%' OR v_log.details LIKE '%' || description || '%');
        ELSIF v_log.source_type = 'transaction' THEN
            DELETE FROM transactions WHERE id = v_log.source_id AND user_id = p_user_id;
        END IF;
    END IF;

    -- 5. Delete original log
    DELETE FROM ledger_logs WHERE id = p_log_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
