
-- Migration: Hardened Mutual Funds System with Realized PnL and Sell Support
-- Purpose: Bring Mutual Funds parity with the high-integrity Stocks system.

-- 1. Schema Update for MF Trades
ALTER TABLE public.mutual_fund_trades ADD COLUMN IF NOT EXISTS ledger_log_id UUID REFERENCES public.ledger_logs(id) ON DELETE SET NULL;
ALTER TABLE public.mutual_fund_trades ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE public.mutual_fund_trades ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- 2. New Hardened MF Recording Function (V3)
CREATE OR REPLACE FUNCTION record_mf_investment_v3(
    p_user_id UUID,
    p_fund_name TEXT,
    p_scheme_code TEXT,
    p_units NUMERIC,
    p_nav NUMERIC,
    p_investment_type TEXT,
    p_category TEXT,
    p_amc_name TEXT,
    p_date DATE,
    p_account_id UUID,
    p_stamp_duty NUMERIC,
    p_trade_type TEXT DEFAULT 'buy'
) RETURNS JSONB AS $$
DECLARE
    v_mf_id UUID;
    v_total_amount NUMERIC; -- Includes charges (Net Capital Movement)
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_existing_holding RECORD;
    v_new_qty NUMERIC;
    v_new_avg_nav NUMERIC;
    v_trade_realized_pnl NUMERIC := 0;
    v_log_id UUID;
BEGIN
    -- 1. Calculate Financials
    -- On BUY: Total Outflow = (Units * Nav) + StampDuty
    -- On SELL: Total Inflow = (Units * Nav) - Charges (if any)
    IF p_trade_type = 'buy' THEN
        v_total_amount := (p_units * p_nav) + p_stamp_duty;
    ELSE
        v_total_amount := (p_units * p_nav) - p_stamp_duty; -- Using stamp_duty parameter as generic charges
    END IF;

    -- 2. Lock Portfolio and Account
    SELECT * INTO v_existing_holding FROM mutual_funds 
    WHERE user_id = p_user_id AND fund_symbol = p_scheme_code
    FOR UPDATE;

    SELECT balance, name INTO v_old_balance, v_account_name
    FROM accounts WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Fund account not found'; END IF;

    -- 3. Update Portfolio
    IF p_trade_type = 'buy' THEN
        IF v_existing_holding IS NOT NULL THEN
            v_new_qty := v_existing_holding.units + p_units;
            v_new_avg_nav := ((v_existing_holding.units * v_existing_holding.avg_nav) + v_total_amount) / v_new_qty;
            
            UPDATE mutual_funds SET 
                units = v_new_qty,
                avg_nav = v_new_avg_nav,
                current_nav = p_nav,
                updated_at = NOW()
            WHERE id = v_existing_holding.id;
            v_mf_id := v_existing_holding.id;
        ELSE
            v_new_avg_nav := v_total_amount / p_units;
            INSERT INTO mutual_funds (
                user_id, fund_name, fund_symbol, units, avg_nav, current_nav, investment_type, category, amc_name
            ) VALUES (
                p_user_id, p_fund_name, p_scheme_code, p_units, v_new_avg_nav, p_nav, p_investment_type, p_category, p_amc_name
            ) RETURNING id INTO v_mf_id;
        END IF;
    ELSE
        -- SELL (Redemption)
        IF v_existing_holding IS NULL OR v_existing_holding.units < p_units THEN
            RAISE EXCEPTION 'Insufficient units to redeem. You have % units.', COALESCE(v_existing_holding.units, 0);
        END IF;

        v_new_qty := v_existing_holding.units - p_units;
        v_trade_realized_pnl := v_total_amount - (v_existing_holding.avg_nav * p_units);

        UPDATE mutual_funds SET 
            units = v_new_qty,
            realized_pnl = COALESCE(realized_pnl, 0) + v_trade_realized_pnl,
            current_nav = p_nav,
            updated_at = NOW()
        WHERE id = v_existing_holding.id;
        v_mf_id := v_existing_holding.id;
    END IF;

    -- 4. Move Funds
    IF p_trade_type = 'buy' THEN
        IF v_old_balance < v_total_amount THEN
            RAISE EXCEPTION 'Insufficient balance in %. Required: ₹%', v_account_name, v_total_amount;
        END IF;
        v_new_balance := v_old_balance - v_total_amount;
    ELSE
        v_new_balance := v_old_balance + v_total_amount;
    END IF;

    UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

    -- 5. Ledger & Transactions
    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_id, source_type
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 
        CASE WHEN p_trade_type = 'buy' THEN 'ADJUST_DOWN' ELSE 'ADJUST_UP' END, 
        v_total_amount, v_old_balance, v_new_balance, 
        (CASE WHEN p_trade_type = 'buy' THEN 'Subscribed ' ELSE 'Redeemed ' END) || p_units || ' units of ' || p_fund_name,
        v_mf_id, 'mutual_fund'
    ) RETURNING id INTO v_log_id;

    INSERT INTO transactions (
        user_id, account_id, description, amount, type, category, date,
        source_id, source_type, ledger_log_id
    ) VALUES (
        p_user_id, p_account_id, 
        (CASE WHEN p_trade_type = 'buy' THEN 'MF Subscription: ' ELSE 'MF Redemption: ' END) || p_fund_name,
        v_total_amount, 
        CASE WHEN p_trade_type = 'buy' THEN 'expense' ELSE 'income' END,
        'Investments', p_date,
        v_mf_id, 'mutual_fund', v_log_id
    );

    -- 6. Log Specific Trade
    INSERT INTO mutual_fund_trades (
        user_id, mf_id, fund_name, trade_type, units, nav, amount, date, ledger_log_id, realized_pnl, account_id
    ) VALUES (
        p_user_id, v_mf_id, p_fund_name, UPPER(p_trade_type), p_units, p_nav, v_total_amount, p_date, v_log_id, v_trade_realized_pnl, p_account_id
    );

    RETURN jsonb_build_object('success', true, 'mf_id', v_mf_id, 'log_id', v_log_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Extend revert_ledger_log to handle Mutual Funds Sells accurately
-- We'll patch the existing function to include MF reversal logic
CREATE OR REPLACE FUNCTION revert_ledger_log(
    p_log_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_log RECORD;
    v_trade RECORD;
    v_mf_trade RECORD;
    v_inv RECORD;
    v_mf RECORD;
    v_current_balance NUMERIC;
    v_rev_amount NUMERIC;
BEGIN
    -- 1. Fetch log
    SELECT * INTO v_log FROM ledger_logs WHERE id = p_log_id AND user_id = p_user_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Log entry not found'); END IF;

    -- 2. Portfolio Reversals (STOCK)
    IF v_log.source_type = 'investment' THEN
        SELECT * INTO v_trade FROM stock_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id;
        IF FOUND THEN
            SELECT * INTO v_inv FROM investments WHERE id = v_trade.investment_id FOR UPDATE;
            IF v_trade.trade_type = 'buy' THEN
                IF v_inv.quantity >= v_trade.quantity THEN
                    IF (v_inv.quantity - v_trade.quantity) > 0 THEN
                        UPDATE investments SET 
                            quantity = quantity - v_trade.quantity,
                            buy_price = ((quantity * buy_price) - v_trade.total_amount) / (quantity - v_trade.quantity),
                            updated_at = NOW()
                        WHERE id = v_inv.id;
                    ELSE
                        UPDATE investments SET quantity = 0, buy_price = 0 WHERE id = v_inv.id;
                    END IF;
                END IF;
            ELSE
                UPDATE investments SET 
                    quantity = quantity + v_trade.quantity,
                    realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_trade.realized_pnl, 0),
                    updated_at = NOW()
                WHERE id = v_inv.id;
            END IF;
            DELETE FROM stock_trades WHERE id = v_trade.id;
        END IF;
    END IF;

    -- 3. Portfolio Reversals (MUTUAL FUND)
    IF v_log.source_type = 'mutual_fund' THEN
        SELECT * INTO v_mf_trade FROM mutual_fund_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id;
        IF FOUND THEN
            SELECT * INTO v_mf FROM mutual_funds WHERE id = v_mf_trade.mf_id FOR UPDATE;
            IF v_mf_trade.trade_type = 'BUY' THEN
                IF v_mf.units >= v_mf_trade.units THEN
                    IF (v_mf.units - v_mf_trade.units) > 0 THEN
                        UPDATE mutual_funds SET 
                            units = units - v_mf_trade.units,
                            avg_nav = ((units * avg_nav) - v_mf_trade.amount) / (units - v_mf_trade.units)
                        WHERE id = v_mf.id;
                    ELSE
                        UPDATE mutual_funds SET units = 0, avg_nav = 0 WHERE id = v_mf.id;
                    END IF;
                END IF;
            ELSE
                UPDATE mutual_funds SET 
                    units = units + v_mf_trade.units,
                    realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_mf_trade.realized_pnl, 0)
                WHERE id = v_mf.id;
            END IF;
            DELETE FROM mutual_fund_trades WHERE id = v_mf_trade.id;
        END IF;
    END IF;

    -- 4. Clean up generic sources
    IF v_log.source_type = 'income' THEN DELETE FROM incomes WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'expense' THEN DELETE FROM expenses WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'transfer' THEN 
        DELETE FROM transfers WHERE id = v_log.source_id AND user_id = p_user_id;
        DELETE FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id;
    END IF;

    DELETE FROM transactions WHERE ledger_log_id = p_log_id;

    -- 5. Account Balance Reversal
    SELECT balance INTO v_current_balance FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;
    IF FOUND THEN
        v_rev_amount := CASE 
            WHEN v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY') THEN v_log.amount 
            WHEN v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN', 'SEND_MONEY_IN', 'INVESTMENT_MF') THEN -v_log.amount 
            ELSE 0 
        END;
        IF v_rev_amount != 0 THEN
            UPDATE accounts SET balance = v_current_balance + v_rev_amount WHERE id = v_log.account_id;
        END IF;
    END IF;

    DELETE FROM ledger_logs WHERE id = p_log_id;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
