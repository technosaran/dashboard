-- Migration: Comprehensive Audit & Reversal Engine v2
-- Purpose: Restore CREATE/DELETE reversal logic and ensure silent operation across all types

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
    v_meta JSONB;
BEGIN
    -- 1. Fetch log and lock it
    SELECT * INTO v_log FROM ledger_logs 
    WHERE id = p_log_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Log entry not found or access denied');
    END IF;

    -- 2. Handle CRUD Operatons (Create/Delete Account)
    IF v_log.action_type = 'CREATE' THEN
        -- Reverting a create means deleting the account
        DELETE FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id;
        DELETE FROM ledger_logs WHERE id = p_log_id;
        RETURN jsonb_build_object('success', true);
    ELSIF v_log.action_type = 'DELETE' THEN
        -- Reverting a delete means restoring from metadata
        v_meta := v_log.metadata;
        IF v_meta IS NOT NULL THEN
            INSERT INTO accounts (
                id, user_id, name, type, balance, color, institution, account_number, created_at
            ) VALUES (
                (v_meta->>'id')::UUID,
                (v_meta->>'user_id')::UUID,
                v_meta->>'name',
                v_meta->>'type',
                (v_meta->>'balance')::NUMERIC,
                v_meta->>'color',
                v_meta->>'institution',
                v_meta->>'account_number',
                (v_meta->>'created_at')::TIMESTAMPTZ
            );
            DELETE FROM ledger_logs WHERE id = p_log_id;
            RETURN jsonb_build_object('success', true);
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'No restoration data found in log');
        END IF;
    END IF;

    -- 3. Handle Transfer Reversal (Silent)
    IF v_log.source_type = 'transfer' AND v_log.source_id IS NOT NULL THEN
        -- Find both logs for this transfer
        FOR v_other_log IN SELECT * FROM ledger_logs WHERE source_id = v_log.source_id AND source_type = 'transfer' AND user_id = p_user_id LOOP
            SELECT balance INTO v_current_balance FROM accounts WHERE id = v_other_log.account_id AND user_id = p_user_id FOR UPDATE;
            
            IF v_other_log.action_type = 'TRANSFER_OUT' THEN
                v_rev_amount := v_other_log.amount; -- Give back
            ELSE
                v_rev_amount := -v_other_log.amount; -- Take back
            END IF;

            v_new_balance := v_current_balance + v_rev_amount;
            UPDATE accounts SET balance = v_new_balance WHERE id = v_other_log.account_id;
        END LOOP;

        -- Cleanup source tables
        DELETE FROM transfers WHERE id = v_log.source_id AND user_id = p_user_id;
        DELETE FROM ledger_logs WHERE source_id = v_log.source_id AND source_type = 'transfer' AND user_id = p_user_id;

        RETURN jsonb_build_object('success', true);
    END IF;

    -- 4. Handle Single Log Reversal (Expense, Income, Adjustment, Send Money)
    IF v_log.account_id IS NOT NULL AND v_log.amount IS NOT NULL THEN
        SELECT balance INTO v_current_balance FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;

        IF FOUND THEN
            -- Check for all debit-like actions
            IF v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY') THEN
                v_rev_amount := v_log.amount; -- Refund
            ELSIF v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN') THEN
                v_rev_amount := -v_log.amount; -- Charge
            ELSE
                v_rev_amount := 0;
            END IF;

            IF v_rev_amount != 0 THEN
                v_new_balance := v_current_balance + v_rev_amount;
                UPDATE accounts SET balance = v_new_balance WHERE id = v_log.account_id;
            END IF;
        END IF;
    END IF;

    -- 5. Deep Cleanup for individual sources
    IF v_log.source_id IS NOT NULL THEN
        IF v_log.source_type = 'expense' THEN
            DELETE FROM expenses WHERE id = v_log.source_id AND user_id = p_user_id;
            -- Improved: only fuzzy match if source_id wasn't enough (usually it is now)
            DELETE FROM transactions WHERE user_id = p_user_id AND (id = v_log.source_id OR (account_id = v_log.account_id AND amount = v_log.amount AND (description LIKE '%' || v_log.details || '%' OR v_log.details LIKE '%' || description || '%')));
        
        ELSIF v_log.source_type = 'income' THEN
            DELETE FROM incomes WHERE id = v_log.source_id AND user_id = p_user_id;
            DELETE FROM transactions WHERE user_id = p_user_id AND (id = v_log.source_id OR (account_id = v_log.account_id AND amount = v_log.amount AND type='income' AND (description LIKE '%' || v_log.details || '%' OR v_log.details LIKE '%' || description || '%')));

        ELSIF v_log.source_type = 'transaction' THEN
            DELETE FROM transactions WHERE id = v_log.source_id AND user_id = p_user_id;
        END IF;
    END IF;

    -- 6. Delete original log
    DELETE FROM ledger_logs WHERE id = p_log_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
