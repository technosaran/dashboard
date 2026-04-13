
-- Migration: Add Investment Undo Support to Ledger
-- Purpose: When a stock transaction is reverted from the ledger, the corresponding investment record should also be removed/updated.

-- 1. Update revert_ledger_log to support 'investment' source type
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
        FOR v_other_log IN SELECT * FROM ledger_logs WHERE source_id = v_log.source_id AND source_type = 'transfer' AND user_id = p_user_id LOOP
            SELECT balance INTO v_current_balance FROM accounts WHERE id = v_other_log.account_id AND user_id = p_user_id FOR UPDATE;
            
            IF v_other_log.action_type = 'TRANSFER_OUT' THEN
                v_rev_amount := v_other_log.amount;
            ELSE
                v_rev_amount := -v_other_log.amount;
            END IF;

            v_new_balance := v_current_balance + v_rev_amount;
            UPDATE accounts SET balance = v_new_balance WHERE id = v_other_log.account_id;

            INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
            VALUES (p_user_id, v_other_log.account_id, v_other_log.account_name, 
                   CASE WHEN v_rev_amount > 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
                   ABS(v_rev_amount), v_current_balance, v_new_balance, 'REVERSAL OF TRANSFER: ' || v_other_log.details);
        END LOOP;

        DELETE FROM transfers WHERE id = v_log.source_id AND user_id = p_user_id;
        DELETE FROM ledger_logs WHERE source_id = v_log.source_id AND source_type = 'transfer' AND user_id = p_user_id;

        RETURN jsonb_build_object('success', true);
    END IF;

    -- 3. Handle Single Log Reversal (Expense, Income, Investment, etc.)
    IF v_log.account_id IS NOT NULL AND v_log.amount IS NOT NULL THEN
        SELECT balance INTO v_current_balance FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;

        IF FOUND THEN
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
            DELETE FROM transactions WHERE account_id = v_log.account_id AND amount = v_log.amount AND user_id = p_user_id AND (description LIKE '%' || v_log.details || '%' OR v_log.details LIKE '%' || description || '%');
        ELSIF v_log.source_type = 'transaction' THEN
            DELETE FROM transactions WHERE id = v_log.source_id AND user_id = p_user_id;
        ELSIF v_log.source_type = 'investment' THEN
            DELETE FROM investments WHERE id = v_log.source_id AND user_id = p_user_id;
            -- Also cleanup matching transaction if any
            DELETE FROM transactions WHERE account_id = v_log.account_id AND amount = v_log.amount AND user_id = p_user_id AND (description LIKE '%' || v_log.details || '%' OR v_log.details LIKE '%' || description || '%');
        END IF;
    END IF;

    -- 5. Delete original log
    DELETE FROM ledger_logs WHERE id = p_log_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create RPC for atomic investment recording with ledger logging
CREATE OR REPLACE FUNCTION record_investment(
    p_user_id UUID,
    p_name TEXT,
    p_type TEXT,
    p_symbol TEXT,
    p_quantity NUMERIC,
    p_buy_price NUMERIC,
    p_current_price NUMERIC,
    p_currency TEXT,
    p_notes TEXT,
    p_date DATE,
    p_account_id UUID,
    p_total_cost NUMERIC,
    p_trade_type TEXT -- 'buy' or 'sell'
) RETURNS JSONB AS $$
DECLARE
    v_investment_id UUID;
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_action_type TEXT;
BEGIN
    -- 1. Insert into investments table
    INSERT INTO investments (
        user_id, name, type, symbol, quantity, buy_price, current_price, currency, notes, bought_at
    ) VALUES (
        p_user_id, p_name, p_type, p_symbol, p_quantity, p_buy_price, p_current_price, p_currency, p_notes, p_date
    ) RETURNING id INTO v_investment_id;

    -- 2. Handle fund movement if account is provided
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Account not found';
        END IF;

        IF p_trade_type = 'buy' THEN
            IF v_old_balance < p_total_cost THEN
                RAISE EXCEPTION 'Insufficient balance';
            END IF;
            v_new_balance := v_old_balance - p_total_cost;
            v_action_type := 'ADJUST_DOWN';
        ELSE
            v_new_balance := v_old_balance + p_total_cost;
            v_action_type := 'ADJUST_UP';
        END IF;

        -- Update balance
        UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

        -- Log to transactions table
        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date
        ) VALUES (
            p_user_id, p_account_id, 
            CASE WHEN p_trade_type = 'buy' THEN 'Stock Purchase: ' ELSE 'Stock Sale: ' END || p_name,
            p_total_cost, 
            CASE WHEN p_trade_type = 'buy' THEN 'expense' ELSE 'income' END,
            'Investments', p_date
        );

        -- Log to ledger_logs with source tracking
        INSERT INTO ledger_logs (
            user_id, account_id, account_name, action_type, 
            amount, previous_balance, new_balance, details,
            source_id, source_type
        ) VALUES (
            p_user_id, p_account_id, v_account_name, v_action_type, 
            p_total_cost, v_old_balance, v_new_balance, 
            (CASE WHEN p_trade_type = 'buy' THEN 'Purchase ' ELSE 'Sale ' END) || p_name || ' (' || p_symbol || ')',
            v_investment_id, 'investment'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'investment_id', v_investment_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
