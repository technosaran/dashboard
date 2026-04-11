-- Policy to allow users to delete their ledger logs (required for revert logic)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ledger_logs' AND policyname = 'Users can delete their own ledger logs'
    ) THEN
        CREATE POLICY "Users can delete their own ledger logs"
        ON public.ledger_logs FOR DELETE
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- RPC function to revert a ledger transaction and restore account balance
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

    -- 2. If it has an account_id and is a balance change, revert it
    IF v_log.account_id IS NOT NULL AND v_log.amount IS NOT NULL THEN
        -- Lock account for update
        SELECT balance INTO v_current_balance FROM accounts 
        WHERE id = v_log.account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Associated account no longer exists');
        END IF;

        -- Calculate reversal amount
        -- If we deducted (UP), we must subtract (DOWN) to revert
        -- If we added (UP), we must subtract (DOWN) to revert? No.
        -- If action was ADJUST_DOWN, it means we subtracted. To revert, we ADD.
        -- If action was ADJUST_UP, it means we added. To revert, we SUBTRACT.
        IF v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT') THEN
            v_rev_amount := v_log.amount;
        ELSIF v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN') THEN
            v_rev_amount := -v_log.amount;
        ELSE
            v_rev_amount := 0;
        END IF;

        IF v_rev_amount != 0 THEN
            v_new_balance := v_current_balance + v_rev_amount;
            
            -- Update Account
            UPDATE accounts SET balance = v_new_balance WHERE id = v_log.account_id;

            -- Log the reversal itself to the ledger
            INSERT INTO ledger_logs (
                user_id, account_id, account_name, action_type, 
                amount, previous_balance, new_balance, details
            ) VALUES (
                p_user_id, v_log.account_id, v_log.account_name, 
                CASE WHEN v_rev_amount > 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
                ABS(v_rev_amount), v_current_balance, v_new_balance,
                'Reversal of Log: ' || v_log.details
            );
        END IF;
    END IF;

    -- 3. Delete the original log (mark it as processed by deleting it)
    DELETE FROM ledger_logs WHERE id = p_log_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
