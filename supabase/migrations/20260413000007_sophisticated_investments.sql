-- Migration: Super-Atomic Investment System
-- Purpose: Support weighted average price calculation for buys, realized P&L for sells, and strict balance checking.

CREATE OR REPLACE FUNCTION record_investment(
    p_user_id UUID,
    p_name TEXT,
    p_type TEXT,
    p_symbol TEXT,
    p_quantity NUMERIC,
    p_buy_price NUMERIC, -- This is the trade price
    p_current_price NUMERIC,
    p_currency TEXT,
    p_notes TEXT,
    p_date DATE,
    p_account_id UUID,
    p_total_cost NUMERIC, -- Total including charges
    p_trade_type TEXT -- 'buy' or 'sell'
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
BEGIN
    -- 1. Check for existing holding
    SELECT * INTO v_existing_holding FROM investments 
    WHERE user_id = p_user_id AND symbol = p_symbol AND type = p_type;

    -- 2. Calculate New State
    IF p_trade_type = 'buy' THEN
        IF v_existing_holding IS NOT NULL THEN
            v_new_qty := v_existing_holding.quantity + p_quantity;
            -- Weighted Average Price: ((old_qty * old_price) + (new_qty * new_price)) / total_qty
            v_new_avg_price := ((v_existing_holding.quantity * v_existing_holding.buy_price) + (p_quantity * p_buy_price)) / v_new_qty;
            
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
        -- Realized P&L: (Sell Price - Cost Price) * Qty
        v_profit := (p_buy_price - v_existing_holding.buy_price) * p_quantity;

        UPDATE investments SET 
            quantity = v_new_qty,
            realized_pnl = COALESCE(realized_pnl, 0) + v_profit,
            current_price = p_current_price,
            updated_at = NOW()
        WHERE id = v_existing_holding.id;
        v_investment_id := v_existing_holding.id;
    END IF;

    -- 3. Handle Fund Movement if account is provided
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Deduction account not found';
        END IF;

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

        -- Update balance
        UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

        -- Log to transactions table
        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date
        ) VALUES (
            p_user_id, p_account_id, 
            (CASE WHEN p_trade_type = 'buy' THEN 'Purchase ' ELSE 'Sale ' END) || p_name || ' (' || p_symbol || ')',
            p_total_cost, 
            CASE WHEN p_trade_type = 'buy' THEN 'expense' ELSE 'income' END,
            'Investments', p_date
        );

        -- Log to ledger_logs
        INSERT INTO ledger_logs (
            user_id, account_id, account_name, action_type, 
            amount, previous_balance, new_balance, details,
            source_id, source_type
        ) VALUES (
            p_user_id, p_account_id, v_account_name, v_action_type, 
            p_total_cost, v_old_balance, v_new_balance, 
            (CASE WHEN p_trade_type = 'buy' THEN 'Bought ' ELSE 'Sold ' END) || p_quantity || ' units of ' || p_symbol || ' (Net: ₹' || p_total_cost || ')',
            v_investment_id, 'investment'
        );
    END IF;

    -- 4. Record the specific trade in trade history
    INSERT INTO stock_trades (
        user_id, investment_id, symbol, trade_type, quantity, price, total_amount, trade_date, exchange
    ) VALUES (
        p_user_id, v_investment_id, p_symbol, p_trade_type, p_quantity, p_buy_price, p_total_cost, p_date,
        CASE WHEN p_symbol LIKE '%.BO' THEN 'BSE' ELSE 'NSE' END
    );

    RETURN jsonb_build_object('success', true, 'investment_id', v_investment_id, 'profit', v_profit);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
