-- Migration: Silent Ledger Reversal
-- Purpose: Remove 'REVERSAL OF' log entries from the audit trail when a transaction is reverted.
-- The system will now silently restore the account balance and delete the original log without adding a counter-entry.

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

    -- 3. Source-specific Portfolio Reversal (Stock/Investments)
    IF v_log.source_type = 'investment' AND v_log.source_id IS NOT NULL THEN
        -- Find the trade associated with this log
        SELECT * INTO v_trade FROM stock_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id;
        
        IF FOUND THEN
            -- Lock investment record
            SELECT * INTO v_inv FROM investments WHERE id = v_trade.investment_id FOR UPDATE;
            
            IF v_trade.trade_type = 'buy' THEN
                -- Reverse a BUY: Subtract quantity
                IF v_inv.quantity >= v_trade.quantity THEN
                    UPDATE investments SET 
                        quantity = quantity - v_trade.quantity,
                        updated_at = NOW()
                    WHERE id = v_inv.id;
                ELSE
                    RETURN jsonb_build_object('success', false, 'error', 'Cannot revert buy: Not enough quantity remains in portfolio.');
                END IF;
            ELSE
                -- Reverse a SELL: Add quantity back and reverse realized PnL
                UPDATE investments SET 
                    quantity = quantity + v_trade.quantity,
                    realized_pnl = COALESCE(realized_pnl, 0) - (v_trade.price - buy_price) * v_trade.quantity,
                    updated_at = NOW()
                WHERE id = v_inv.id;
            END IF;
            
            -- Delete the trade record
            DELETE FROM stock_trades WHERE id = v_trade.id;
        END IF;

    ELSIF v_log.source_type = 'transfer' AND v_log.source_id IS NOT NULL THEN
        -- Handle both sides of the transfer SILENTLY
        FOR v_other_log IN SELECT * FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id AND user_id = p_user_id LOOP
            SELECT balance INTO v_current_balance FROM accounts WHERE id = v_other_log.account_id AND user_id = p_user_id FOR UPDATE;
            IF FOUND THEN
                v_rev_amount := CASE WHEN v_other_log.action_type = 'TRANSFER_OUT' THEN v_other_log.amount ELSE -v_other_log.amount END;
                UPDATE accounts SET balance = v_current_balance + v_rev_amount WHERE id = v_other_log.account_id;
                
                -- [SILENT] Removed Reversal Log insertion here
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
                
                -- [SILENT] Removed Reversal Log insertion here
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
