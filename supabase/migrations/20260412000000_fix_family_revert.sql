
-- Fix revert_ledger_log to support SEND_MONEY action type
-- This ensures that when a family transfer is reverted, the money returns to the account.

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

            -- Log reversal
            INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
            VALUES (p_user_id, v_other_log.account_id, v_other_log.account_name, 
                   CASE WHEN v_rev_amount > 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
                   ABS(v_rev_amount), v_current_balance, v_new_balance, 'REVERSAL OF TRANSFER: ' || v_other_log.details);
        END LOOP;

        -- Cleanup source tables
        DELETE FROM transfers WHERE id = v_log.source_id AND user_id = p_user_id;
        DELETE FROM ledger_logs WHERE source_id = v_log.source_id AND source_type = 'transfer' AND user_id = p_user_id;

        RETURN jsonb_build_object('success', true);
    END IF;

    -- 3. Handle Single Log Reversal (Expense, Adjustment, SEND_MONEY, etc.)
    IF v_log.account_id IS NOT NULL AND v_log.amount IS NOT NULL THEN
        SELECT balance INTO v_current_balance FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;

        IF FOUND THEN
            -- FIX: Added 'SEND_MONEY' to the list of actions that should restore balance when reverted
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

                INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
                VALUES (p_user_id, v_log.account_id, v_log.account_name, 
                       CASE WHEN v_rev_amount > 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
                       ABS(v_rev_amount), v_current_balance, v_new_balance, 'REVERSAL OF: ' || v_log.details);
            END IF;
        END IF;
    END IF;

    -- 4. Deep Cleanup for individual sources
    IF v_log.source_id IS NOT NULL THEN
        IF v_log.source_type = 'expense' THEN
            DELETE FROM expenses WHERE id = v_log.source_id AND user_id = p_user_id;
            -- Cleanup matching transaction record
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
