
-- Migration: Fix Stock Sell Logic and Realized PnL Integrity
-- Purpose: Ensure Cost Basis includes charges and Realized PnL is tracked per-trade for accurate reversals.

-- 1. Schema Update
ALTER TABLE public.stock_trades ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC(14, 2) DEFAULT 0;

-- 2. Updated record_investment (V4 - Including Charges in Cost Basis)
CREATE OR REPLACE FUNCTION record_investment(
    p_user_id UUID,
    p_name TEXT,
    p_type TEXT,
    p_symbol TEXT,
    p_quantity NUMERIC,
    p_buy_price NUMERIC, -- Raw price
    p_current_price NUMERIC,
    p_currency TEXT,
    p_notes TEXT,
    p_date DATE,
    p_account_id UUID,
    p_total_cost NUMERIC, -- This is (price * qty) + charges on BUY, or (price * qty) - charges on SELL
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
    v_trade_realized_pnl NUMERIC := 0;
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
            
            -- COST BASIS IMPROVEMENT: Include buy charges in avg price
            -- (OldValue + TotalCostOfNewTrade) / TotalQty
            IF v_new_qty > 0 THEN
                v_new_avg_price := ((v_existing_holding.quantity * v_existing_holding.buy_price) + p_total_cost) / v_new_qty;
            ELSE
                v_new_avg_price := p_total_cost / p_quantity;
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
            -- Initial buy sets avg price = total cost / qty (includes charges)
            v_new_avg_price := p_total_cost / p_quantity;
            
            INSERT INTO investments (
                user_id, name, type, symbol, quantity, buy_price, current_price, currency, notes, bought_at
            ) VALUES (
                p_user_id, p_name, p_type, p_symbol, p_quantity, v_new_avg_price, p_current_price, p_currency, p_notes, p_date
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
        
        -- PROFIT CALCULATION: (Cash Received from Sell) - (Original Cost Basis * Qty Sold)
        -- Cash Received is p_total_cost (which is Turnover - Charges in SELL)
        v_trade_realized_pnl := p_total_cost - (v_existing_holding.buy_price * p_quantity);

        UPDATE investments SET 
            quantity = v_new_qty,
            realized_pnl = COALESCE(realized_pnl, 0) + v_trade_realized_pnl,
            current_price = p_current_price,
            updated_at = NOW()
        WHERE id = v_existing_holding.id;
        v_investment_id := v_existing_holding.id;
    END IF;

    -- 3. Handle Fund Movement (Accounts)
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN RAISE EXCEPTION 'Fund account not found'; END IF;

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

    -- 4. Record Trade History (With Realized PnL for accurate Undo)
    INSERT INTO stock_trades (
        user_id, investment_id, symbol, trade_type, quantity, price, total_amount, trade_date, exchange, charges, ledger_log_id, realized_pnl
    ) VALUES (
        p_user_id, v_investment_id, p_symbol, p_trade_type, p_quantity, p_buy_price, p_total_cost, p_date,
        CASE WHEN p_symbol LIKE '%.BO' THEN 'BSE' ELSE 'NSE' END,
        p_charges, v_log_id, v_trade_realized_pnl
    );

    RETURN jsonb_build_object('success', true, 'investment_id', v_investment_id, 'profit', v_trade_realized_pnl, 'log_id', v_log_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Fixed revert_ledger_log (V5 - Atomic Portfolio Reversals using Stored Trade Profit)
CREATE OR REPLACE FUNCTION revert_ledger_log(
    p_log_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_log RECORD;
    v_trade RECORD;
    v_inv RECORD;
    v_current_balance NUMERIC;
    v_rev_amount NUMERIC;
    v_new_qty NUMERIC;
BEGIN
    -- 1. Fetch log and lock it
    SELECT * INTO v_log FROM ledger_logs 
    WHERE id = p_log_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Log entry not found');
    END IF;

    -- 2. Handle Portfolio-Linked Reversal (Investment Side)
    IF v_log.source_type = 'investment' AND v_log.source_id IS NOT NULL THEN
        -- Find the specific trade linked to this log
        SELECT * INTO v_trade FROM stock_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id;
        
        IF FOUND THEN
            -- Lock investment record
            SELECT * INTO v_inv FROM investments WHERE id = v_trade.investment_id FOR UPDATE;
            
            IF v_trade.trade_type = 'buy' THEN
                -- REVERSE BUY: Subtract quantity
                -- Note: Average price restoration is best-effort or requires history recalculation.
                -- However, for the most recent trade, subtracting total_amount from cost basis restores previous state.
                IF v_inv.quantity >= v_trade.quantity THEN
                    IF (v_inv.quantity - v_trade.quantity) > 0 THEN
                        v_new_qty := v_inv.quantity - v_trade.quantity;
                        -- Logic: (CurrentTotalCost - TradeTotalCost) / RemainingQty
                        UPDATE investments SET 
                            quantity = v_new_qty,
                            buy_price = ((v_inv.quantity * v_inv.buy_price) - v_trade.total_amount) / v_new_qty,
                            updated_at = NOW()
                        WHERE id = v_inv.id;
                    ELSE
                        -- Last trade removed, reset
                        UPDATE investments SET quantity = 0, buy_price = 0 WHERE id = v_inv.id;
                    END IF;
                ELSE
                    RETURN jsonb_build_object('success', false, 'error', 'Cannot revert purchase: Portfolio quantity mismatch.');
                END IF;
            ELSE
                -- REVERSE SELL: Add quantity back and SUBTRACT THE SPECIFIC REALIZED PNL from this trade
                UPDATE investments SET 
                    quantity = quantity + v_trade.quantity,
                    realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_trade.realized_pnl, 0),
                    updated_at = NOW()
                WHERE id = v_inv.id;
            END IF;
            
            -- Delete the trade record
            DELETE FROM stock_trades WHERE id = v_trade.id;
        END IF;
    END IF;

    -- 3. Handle Other Source Specific Deletions
    IF v_log.source_type = 'income' AND v_log.source_id IS NOT NULL THEN
        DELETE FROM incomes WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'expense' AND v_log.source_id IS NOT NULL THEN
        DELETE FROM expenses WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'transfer' AND v_log.source_id IS NOT NULL THEN
        DELETE FROM transfers WHERE id = v_log.source_id AND user_id = p_user_id;
        -- Transfer logs are often deleted as part of a pair in separate calls or sibling logic
    END IF;

    -- 4. Clean up transactions and ledger history
    DELETE FROM transactions WHERE ledger_log_id = p_log_id AND user_id = p_user_id;

    -- 5. Restore Account Balance
    IF v_log.account_id IS NOT NULL AND v_log.amount IS NOT NULL THEN
        SELECT balance INTO v_current_balance FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;

        IF FOUND THEN
            -- Determine reversal sign
            IF v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY') THEN
                v_rev_amount := v_log.amount; -- Give money back
            ELSIF v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN', 'SEND_MONEY_IN') THEN
                v_rev_amount := -v_log.amount; -- Take money back
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
