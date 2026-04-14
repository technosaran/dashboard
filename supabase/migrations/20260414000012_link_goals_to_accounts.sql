-- Migration: Link Goals to Accounts
-- Purpose: Deduct goal contributions from accounts and log them in the ledger.

-- 1. Drop old function to change signature
DROP FUNCTION IF EXISTS contribute_to_goal(UUID, NUMERIC);

-- 2. Create updated contribute_to_goal
CREATE OR REPLACE FUNCTION contribute_to_goal(
    p_user_id UUID,
    p_goal_id UUID,
    p_account_id UUID,
    p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_goal_name TEXT;
    v_log_id UUID;
BEGIN
    -- 1. Validate and Lock Account
    SELECT balance, name INTO v_old_balance, v_account_name
    FROM accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found';
    END IF;

    IF v_old_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance in %. Available: ₹%', v_account_name, v_old_balance;
    END IF;

    -- 2. Validate Goal
    SELECT name INTO v_goal_name
    FROM goals
    WHERE id = p_goal_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Goal not found';
    END IF;

    -- 3. Execute Deduction
    v_new_balance := v_old_balance - p_amount;
    UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

    -- 4. Update Goal
    UPDATE goals SET current_amount = current_amount + p_amount WHERE id = p_goal_id;

    -- 5. Log to Ledger
    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_id, source_type
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 'ADJUST_DOWN', 
        p_amount, v_old_balance, v_new_balance, 
        'Goal Contribution: ' || v_goal_name,
        p_goal_id, 'goal'
    ) RETURNING id INTO v_log_id;

    -- 6. Log to Transactions
    INSERT INTO transactions (
        user_id, account_id, description, amount, type, category, date,
        source_id, source_type, ledger_log_id
    ) VALUES (
        p_user_id, p_account_id, 'Contribution to ' || v_goal_name, p_amount, 'expense', 'Goals', CURRENT_DATE,
        p_goal_id, 'goal', v_log_id
    );

    RETURN jsonb_build_object('success', true, 'log_id', v_log_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update revert_ledger_log to support Goal Reversals
-- Note: Using the silent reversal logic established in previous migration.
CREATE OR REPLACE FUNCTION revert_ledger_log(
    p_log_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_log RECORD;
    v_trade RECORD;
    v_inv RECORD;
    v_other_log RECORD;
    v_current_balance NUMERIC;
    v_rev_amount NUMERIC;
    v_meta JSONB;
BEGIN
    -- 1. Fetch log and lock it
    SELECT * INTO v_log FROM ledger_logs 
    WHERE id = p_log_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Log entry not found or access denied');
    END IF;

    -- 2. Handle CRUD Operations (Account Creation/Deletion)
    IF v_log.action_type = 'CREATE' THEN
         IF EXISTS (SELECT 1 FROM transactions WHERE account_id = v_log.account_id LIMIT 1) THEN
              RETURN jsonb_build_object('success', false, 'error', 'Cannot undo account creation: Existing transactions detected.');
         END IF;
         DELETE FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id;
         DELETE FROM ledger_logs WHERE id = p_log_id;
         RETURN jsonb_build_object('success', true);

    ELSIF v_log.action_type = 'DELETE' THEN
        v_meta := v_log.metadata;
        IF v_meta IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM accounts WHERE id = (v_meta->>'id')::UUID) THEN
                RETURN jsonb_build_object('success', false, 'error', 'Account already exists.');
            END IF;

            INSERT INTO accounts (
                id, user_id, name, type, balance, currency, bank_name, created_at
            ) VALUES (
                (v_meta->>'id')::UUID, (v_meta->>'user_id')::UUID, v_meta->>'name', v_meta->>'type',
                (v_meta->>'balance')::NUMERIC, COALESCE(v_meta->>'currency', 'INR'), v_meta->>'bank_name',
                (v_meta->>'created_at')::TIMESTAMPTZ
            );
            DELETE FROM ledger_logs WHERE id = p_log_id;
            RETURN jsonb_build_object('success', true);
        END IF;
    END IF;

    -- 3. Source-specific Reversals
    IF v_log.source_type = 'investment' AND v_log.source_id IS NOT NULL THEN
        SELECT * INTO v_trade FROM stock_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id;
        IF FOUND THEN
            SELECT * INTO v_inv FROM investments WHERE id = v_trade.investment_id FOR UPDATE;
            IF v_trade.trade_type = 'buy' THEN
                IF v_inv.quantity >= v_trade.quantity THEN
                    UPDATE investments SET quantity = quantity - v_trade.quantity, updated_at = NOW() WHERE id = v_inv.id;
                ELSE
                    RETURN jsonb_build_object('success', false, 'error', 'Cannot revert buy: Not enough quantity remains.');
                END IF;
            ELSE
                UPDATE investments SET 
                    quantity = quantity + v_trade.quantity,
                    realized_pnl = COALESCE(realized_pnl, 0) - (v_trade.price - buy_price) * v_trade.quantity,
                    updated_at = NOW()
                WHERE id = v_inv.id;
            END IF;
            DELETE FROM stock_trades WHERE id = v_trade.id;
        END IF;

    ELSIF v_log.source_type = 'goal' AND v_log.source_id IS NOT NULL THEN
        -- Reverse Goal Contribution
        UPDATE goals SET current_amount = current_amount - v_log.amount WHERE id = v_log.source_id AND user_id = p_user_id;

    ELSIF v_log.source_type = 'transfer' AND v_log.source_id IS NOT NULL THEN
        FOR v_other_log IN SELECT * FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id AND user_id = p_user_id LOOP
            SELECT balance INTO v_current_balance FROM accounts WHERE id = v_other_log.account_id AND user_id = p_user_id FOR UPDATE;
            IF FOUND THEN
                v_rev_amount := CASE WHEN v_other_log.action_type = 'TRANSFER_OUT' THEN v_other_log.amount ELSE -v_other_log.amount END;
                UPDATE accounts SET balance = v_current_balance + v_rev_amount WHERE id = v_other_log.account_id;
            END IF;
        END LOOP;
        DELETE FROM transfers WHERE id = v_log.source_id AND user_id = p_user_id;
        DELETE FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id AND user_id = p_user_id;

    ELSIF v_log.source_type = 'income' AND v_log.source_id IS NOT NULL THEN
        DELETE FROM incomes WHERE id = v_log.source_id AND user_id = p_user_id;
    
    ELSIF v_log.source_type = 'expense' AND v_log.source_id IS NOT NULL THEN
        DELETE FROM expenses WHERE id = v_log.source_id AND user_id = p_user_id;
    END IF;

    -- 4. Clean up generic transaction record if exists
    DELETE FROM transactions WHERE ledger_log_id = p_log_id AND user_id = p_user_id;

    -- 5. Handle Balance Reversal for the current log's account SILENTLY
    IF v_log.account_id IS NOT NULL AND v_log.amount IS NOT NULL THEN
        SELECT balance INTO v_current_balance FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;

        IF FOUND THEN
            IF v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY') THEN
                v_rev_amount := v_log.amount;
            ELSIF v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN', 'SEND_MONEY_IN') THEN
                v_rev_amount := -v_log.amount;
            ELSE
                v_rev_amount := 0;
            END IF;

            IF v_rev_amount != 0 THEN
                UPDATE accounts SET balance = v_current_balance + v_rev_amount WHERE id = v_log.account_id;
            END IF;
        END IF;
    END IF;

    -- 6. Finally delete original log
    DELETE FROM ledger_logs WHERE id = p_log_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
