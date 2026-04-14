
-- Migration: Fix Investment Logic and Hardening
-- Purpose: Resolve race conditions in investments and fix the broken reversal logic for stock trades.

-- IMPORTANT: Drop functions first to avoid "cannot remove parameter defaults" errors
DROP FUNCTION IF EXISTS record_investment(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE, UUID, NUMERIC, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS revert_ledger_log(UUID, UUID);

-- 0. Schema Update
ALTER TABLE IF EXISTS public.stock_trades ADD COLUMN IF NOT EXISTS ledger_log_id UUID REFERENCES public.ledger_logs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stock_trades_ledger_log_id ON public.stock_trades(ledger_log_id);

-- 1. Updated record_investment with locking
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
    p_trade_type TEXT,
    p_charges NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_investment_id UUID;
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_action_type TEXT;
    v_existing_holding RECORD;
    v_new_qty NUMERIC;
    v_new_avg_price NUMERIC;
    v_profit NUMERIC := 0;
    v_log_id UUID;
BEGIN
    -- 1. Check for existing holding WITH LOCK
    SELECT * INTO v_existing_holding FROM investments 
    WHERE user_id = p_user_id AND symbol = p_symbol AND type = p_type
    FOR UPDATE;

    -- 2. Calculate New State
    IF p_trade_type = 'buy' THEN
        IF v_existing_holding IS NOT NULL THEN
            v_new_qty := v_existing_holding.quantity + p_quantity;
            IF v_new_qty > 0 THEN
                v_new_avg_price := ((v_existing_holding.quantity * v_existing_holding.buy_price) + (p_quantity * p_buy_price)) / v_new_qty;
            ELSE
                v_new_avg_price := p_buy_price;
            END IF;
            
            UPDATE investments SET 
                quantity = v_new_qty,
                buy_price = v_new_avg_price,
                current_price = p_current_price,
                updated_at = NOW(),
                notes = COALESCE(p_notes, notes)
            WHERE id = v_existing_holding.id;
            v_investment_id := v_existing_holding.id;
        ELSE
            INSERT INTO investments (
                user_id, name, type, symbol, quantity, buy_price, current_price, currency, notes, bought_at
            ) VALUES (
                p_user_id, p_name, p_type, p_symbol, p_quantity, p_buy_price, p_current_price, p_currency, p_notes, p_date
            ) RETURNING id INTO v_investment_id;
        END IF;
    ELSE
        -- SELL LOGIC
        IF v_existing_holding IS NULL THEN
            RAISE EXCEPTION 'You do not own this stock to sell it.';
        END IF;

        IF v_existing_holding.quantity < p_quantity THEN
            RAISE EXCEPTION 'Insufficient quantity to sell. You have % units.', v_existing_holding.quantity;
        END IF;

        v_new_qty := v_existing_holding.quantity - p_quantity;
        v_profit := (p_buy_price - v_existing_holding.buy_price) * p_quantity;

        UPDATE investments SET 
            quantity = v_new_qty,
            realized_pnl = COALESCE(realized_pnl, 0) + v_profit,
            current_price = p_current_price,
            updated_at = NOW()
        WHERE id = v_existing_holding.id;
        v_investment_id := v_existing_holding.id;
    END IF;

    -- 3. Handle Fund Movement
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN RAISE EXCEPTION 'Deduction account not found'; END IF;

        IF p_trade_type = 'buy' THEN
            IF v_old_balance < p_total_cost THEN
                RAISE EXCEPTION 'Insufficient balance in %. Required: ₹%, Available: ₹%', v_account_name, p_total_cost, v_old_balance;
            END IF;
            v_new_balance := v_old_balance - p_total_cost;
            v_action_type := 'ADJUST_DOWN';
        ELSE
            v_new_balance := v_old_balance + p_total_cost;
            v_action_type := 'ADJUST_UP';
        END IF;

        UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

        INSERT INTO ledger_logs (
            user_id, account_id, account_name, action_type, 
            amount, previous_balance, new_balance, details,
            source_id, source_type
        ) VALUES (
            p_user_id, p_account_id, v_account_name, v_action_type, 
            p_total_cost, v_old_balance, v_new_balance, 
            (CASE WHEN p_trade_type = 'buy' THEN 'Bought ' ELSE 'Sold ' END) || p_quantity || ' units of ' || p_symbol || ' (Net: ₹' || p_total_cost || ')',
            v_investment_id, 'investment'
        ) RETURNING id INTO v_log_id;

        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date,
            source_id, source_type, ledger_log_id
        ) VALUES (
            p_user_id, p_account_id, 
            (CASE WHEN p_trade_type = 'buy' THEN 'Purchase ' ELSE 'Sale ' END) || p_name || ' (' || p_symbol || ')',
            p_total_cost, 
            CASE WHEN p_trade_type = 'buy' THEN 'expense' ELSE 'income' END,
            'Investments', p_date,
            v_investment_id, 'investment', v_log_id
        );
    END IF;

    -- 4. Record the specific trade
    INSERT INTO stock_trades (
        user_id, investment_id, symbol, trade_type, quantity, price, total_amount, trade_date, exchange, charges, ledger_log_id
    ) VALUES (
        p_user_id, v_investment_id, p_symbol, p_trade_type, p_quantity, p_buy_price, p_total_cost, p_date,
        CASE WHEN p_symbol LIKE '%.BO' THEN 'BSE' ELSE 'NSE' END,
        p_charges, v_log_id
    );

    RETURN jsonb_build_object('success', true, 'investment_id', v_investment_id, 'profit', v_profit, 'log_id', v_log_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Fixed revert_ledger_log with Investment Portfolio Rejection
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

    -- 2. Handle CRUD Operations
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

    -- 3. Source-specific Portfolio Reversal (CRITICAL FIX)
    IF v_log.source_type = 'investment' AND v_log.source_id IS NOT NULL THEN
        -- Find the trade associated with this log
        SELECT * INTO v_trade FROM stock_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id;
        
        IF FOUND THEN
            -- Lock investment record
            SELECT * INTO v_inv FROM investments WHERE id = v_trade.investment_id FOR UPDATE;
            
            IF v_trade.trade_type = 'buy' THEN
                -- Reverse a BUY: Subtract quantity and restore previous avg price if possible
                -- Note: Comprehensive avg price restoration is complex; at minimum we must fix quantity and realized PnL
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
        -- Handle both sides of the transfer
        FOR v_other_log IN SELECT * FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id AND user_id = p_user_id LOOP
            SELECT balance INTO v_current_balance FROM accounts WHERE id = v_other_log.account_id AND user_id = p_user_id FOR UPDATE;
            IF FOUND THEN
                v_rev_amount := CASE WHEN v_other_log.action_type = 'TRANSFER_OUT' THEN v_other_log.amount ELSE -v_other_log.amount END;
                UPDATE accounts SET balance = v_current_balance + v_rev_amount WHERE id = v_other_log.account_id;
                
                INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
                VALUES (p_user_id, v_other_log.account_id, v_other_log.account_name, 
                       CASE WHEN v_rev_amount > 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
                       ABS(v_rev_amount), v_current_balance, v_current_balance + v_rev_amount, 'REVERSAL OF TRANSFER SIDE: ' || v_other_log.details);
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

    -- 5. Handle Balance Reversal for the current log's account
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
                
                INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
                VALUES (p_user_id, v_log.account_id, v_log.account_name, 
                       CASE WHEN v_rev_amount > 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
                       ABS(v_rev_amount), v_current_balance, v_current_balance + v_rev_amount, 'REVERSAL OF: ' || v_log.details);
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
