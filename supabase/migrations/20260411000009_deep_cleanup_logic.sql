CREATE OR REPLACE FUNCTION revert_ledger_log(
    p_log_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_log RECORD;
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

    -- 2. Logic Check: Revert Balance Change
    IF v_log.account_id IS NOT NULL AND v_log.amount IS NOT NULL THEN
        SELECT balance INTO v_current_balance FROM accounts 
        WHERE id = v_log.account_id AND user_id = p_user_id
        FOR UPDATE;

        IF FOUND THEN
            -- Calculate reversal amount
            IF v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT') THEN
                v_rev_amount := v_log.amount;
            ELSIF v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN') THEN
                v_rev_amount := -v_log.amount;
            ELSE
                v_rev_amount := 0;
            END IF;

            IF v_rev_amount != 0 THEN
                v_new_balance := v_current_balance + v_rev_amount;
                UPDATE accounts SET balance = v_new_balance WHERE id = v_log.account_id;

                -- Log reversal entry (Audit persistence)
                INSERT INTO ledger_logs (
                    user_id, account_id, account_name, action_type, 
                    amount, previous_balance, new_balance, details
                ) VALUES (
                    p_user_id, v_log.account_id, v_log.account_name, 
                    CASE WHEN v_rev_amount > 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
                    ABS(v_rev_amount), v_current_balance, v_new_balance,
                    'REVERSAL OF: ' || v_log.details
                );
            END IF;
        END IF;
    END IF;

    -- 3. DEEP CLEANUP: Remove associated source entries
    IF v_log.source_id IS NOT NULL THEN
        IF v_log.source_type = 'expense' THEN
            -- Delete from expenses table
            DELETE FROM expenses WHERE id = v_log.source_id AND user_id = p_user_id;
            
            -- ALSO Delete from transactions (Search by matching description/amount/date if no direct link)
            -- But usually, we can target it if we knew the ID. 
            -- For simplicity and logic safety, since it's a revert:
            DELETE FROM transactions WHERE account_id = v_log.account_id AND amount = v_log.amount AND user_id = p_user_id AND description LIKE '%' || split_part(v_log.details, ': ', 2) || '%';
        END IF;
    END IF;

    -- 4. Delete the original log
    DELETE FROM ledger_logs WHERE id = p_log_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
