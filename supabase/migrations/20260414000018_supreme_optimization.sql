
-- Master Optimization & Migration Fix
-- Purpose: Resolve all legacy errors (deposits table) and implement supreme performance scaling.

-- 1. CLEANUP LEGACY REFERENCES (Fixes push errors)
-- We ensure that these don't fail if the table is missing
DO $$ 
BEGIN
    -- Only drop/create if table exists to prevent migration failure
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deposits') THEN
        DROP POLICY IF EXISTS "Users can view their own deposits" ON public.deposits;
        DROP POLICY IF EXISTS "Users can create their own deposits" ON public.deposits;
    END IF;
END $$;

-- 2. HIGH-PERFORMANCE INDEXING
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from_account_id ON public.transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_account_id ON public.transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_incomes_account_id ON public.incomes(account_id);
CREATE INDEX IF NOT EXISTS idx_stock_trades_investment_id ON public.stock_trades(investment_id);
CREATE INDEX IF NOT EXISTS idx_mutual_fund_trades_mf_id ON public.mutual_fund_trades(mf_id);

CREATE INDEX IF NOT EXISTS idx_ledger_logs_user_created ON public.ledger_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC, created_at DESC);

-- 3. INTEGRITY & PARITY
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_investment_per_user ON public.investments(user_id, symbol) WHERE (symbol IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_mf_per_user ON public.mutual_funds(user_id, fund_symbol) WHERE (fund_symbol IS NOT NULL);

-- 4. MASTER RPC: record_mf_investment_v4
-- Purpose: Bring Mutual Funds to Stocks-level fidelity including sell support and ledger linkage.
CREATE OR REPLACE FUNCTION record_mf_investment_v4(
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
    p_stamp_duty NUMERIC DEFAULT 0,
    p_trade_type TEXT DEFAULT 'buy'
) RETURNS JSONB AS $$
DECLARE
    v_mf_id UUID;
    v_total_amount NUMERIC;
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_log_id UUID;
    v_action_type TEXT;
    v_existing_mf RECORD;
    v_new_qty NUMERIC;
    v_new_avg_nav NUMERIC;
    v_realized_pnl NUMERIC := 0;
BEGIN
    -- 1. Financial Impact
    IF p_trade_type = 'buy' THEN
        v_total_amount := (p_units * p_nav) + p_stamp_duty;
        v_action_type := 'ADJUST_DOWN';
    ELSE
        v_total_amount := (p_units * p_nav) - p_stamp_duty;
        v_action_type := 'ADJUST_UP';
    END IF;

    -- 2. Lock Account
    SELECT balance, name INTO v_old_balance, v_account_name
    FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;

    -- 3. Update MF Portfolio
    SELECT * INTO v_existing_mf FROM mutual_funds 
    WHERE user_id = p_user_id AND fund_symbol = p_scheme_code FOR UPDATE;

    IF p_trade_type = 'buy' THEN
        IF v_existing_mf IS NOT NULL THEN
            v_new_qty := v_existing_mf.units + p_units;
            v_new_avg_nav := ((v_existing_mf.units * v_existing_mf.avg_nav) + v_total_amount) / v_new_qty;
            UPDATE mutual_funds SET units = v_new_qty, avg_nav = v_new_avg_nav, current_nav = p_nav, updated_at = NOW() WHERE id = v_existing_mf.id;
            v_mf_id := v_existing_mf.id;
        ELSE
            INSERT INTO mutual_funds (user_id, fund_name, fund_symbol, units, avg_nav, current_nav, investment_type, category, amc_name)
            VALUES (p_user_id, p_fund_name, p_scheme_code, p_units, v_total_amount / p_units, p_nav, p_investment_type, p_category, p_amc_name)
            RETURNING id INTO v_mf_id;
        END IF;
    ELSE
        IF v_existing_mf IS NULL OR v_existing_mf.units < p_units THEN RAISE EXCEPTION 'Insufficient units'; END IF;
        v_realized_pnl := v_total_amount - (v_existing_mf.avg_nav * p_units);
        UPDATE mutual_funds SET units = units - p_units, realized_pnl = COALESCE(realized_pnl, 0) + v_realized_pnl, current_nav = p_nav, updated_at = NOW() WHERE id = v_existing_mf.id;
        v_mf_id := v_existing_mf.id;
    END IF;

    -- 4. Move Funds
    IF p_trade_type = 'buy' AND v_old_balance < v_total_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    v_new_balance := CASE WHEN p_trade_type = 'buy' THEN v_old_balance - v_total_amount ELSE v_old_balance + v_total_amount END;
    UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

    -- 5. Atomic Logging
    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES (p_user_id, p_account_id, v_account_name, v_action_type, v_total_amount, v_old_balance, v_new_balance, 
           (CASE WHEN p_trade_type = 'buy' THEN 'Subscribed ' ELSE 'Redeemed ' END) || p_units || ' units in ' || p_fund_name, v_mf_id, 'mutual_fund')
    RETURNING id INTO v_log_id;

    INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
    VALUES (p_user_id, p_account_id, (CASE WHEN p_trade_type = 'buy' THEN 'MF Buy: ' ELSE 'MF Sell: ' END) || p_fund_name, v_total_amount, 
           CASE WHEN p_trade_type = 'buy' THEN 'expense' ELSE 'income' END, 'Investments', p_date, v_mf_id, 'mutual_fund', v_log_id);

    INSERT INTO mutual_fund_trades (user_id, mf_id, fund_name, trade_type, units, nav, amount, date, ledger_log_id, realized_pnl)
    VALUES (p_user_id, v_mf_id, p_fund_name, UPPER(p_trade_type), p_units, p_nav, v_total_amount, p_date, v_log_id, v_realized_pnl);

    RETURN jsonb_build_object('success', true, 'mf_id', v_mf_id, 'log_id', v_log_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ULTIMATE REVERSAL ENGINE
CREATE OR REPLACE FUNCTION revert_ledger_log(
    p_log_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_log RECORD;
    v_sub_log RECORD;
    v_trade RECORD;
    v_mf_trade RECORD;
    v_item RECORD;
    v_curr_bal NUMERIC;
    v_rev_amt NUMERIC;
    v_meta JSONB;
BEGIN
    SELECT * INTO v_log FROM ledger_logs WHERE id = p_log_id AND user_id = p_user_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Log not found'); END IF;

    -- Handle System Ops
    IF v_log.action_type = 'CREATE' THEN
         DELETE FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id;
         DELETE FROM ledger_logs WHERE id = p_log_id;
         RETURN jsonb_build_object('success', true);
    ELSIF v_log.action_type = 'DELETE' THEN
        v_meta := v_log.metadata;
        IF v_meta IS NOT NULL THEN
            INSERT INTO accounts (id, user_id, name, type, balance, bank_name, created_at)
            VALUES ((v_meta->>'id')::UUID, (v_meta->>'user_id')::UUID, v_meta->>'name', v_meta->>'type', (v_meta->>'balance')::NUMERIC, v_meta->>'bank_name', (v_meta->>'created_at')::TIMESTAMPTZ);
            DELETE FROM ledger_logs WHERE id = p_log_id;
            RETURN jsonb_build_object('success', true);
        END IF;
    END IF;

    -- Rollback Asset Side-effects
    IF v_log.source_type = 'investment' THEN
        SELECT * INTO v_trade FROM stock_trades WHERE ledger_log_id = p_log_id FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM investments WHERE id = v_trade.investment_id FOR UPDATE;
            IF v_trade.trade_type = 'buy' THEN
                IF v_item.quantity >= v_trade.quantity THEN
                    UPDATE investments SET 
                        quantity = quantity - v_trade.quantity,
                        buy_price = CASE WHEN (quantity - v_trade.quantity) > 0 THEN ((quantity * buy_price) - v_trade.total_amount) / (quantity - v_trade.quantity) ELSE 0 END
                    WHERE id = v_item.id;
                END IF;
            ELSE
                UPDATE investments SET quantity = quantity + v_trade.quantity, realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_trade.realized_pnl, 0) WHERE id = v_item.id;
            END IF;
            DELETE FROM stock_trades WHERE id = v_trade.id;
        END IF;
    ELSIF v_log.source_type = 'mutual_fund' THEN
        SELECT * INTO v_mf_trade FROM mutual_fund_trades WHERE ledger_log_id = p_log_id FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM mutual_funds WHERE id = v_mf_trade.mf_id FOR UPDATE;
            IF v_mf_trade.trade_type = 'BUY' THEN
                IF v_item.units >= v_mf_trade.units THEN
                    UPDATE mutual_funds SET 
                        units = units - v_mf_trade.units,
                        avg_nav = CASE WHEN (units - v_mf_trade.units) > 0 THEN ((units * avg_nav) - v_mf_trade.amount) / (units - v_mf_trade.units) ELSE 0 END
                    WHERE id = v_item.id;
                END IF;
            ELSE
                UPDATE mutual_funds SET units = units + v_mf_trade.units, realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_mf_trade.realized_pnl, 0) WHERE id = v_item.id;
            END IF;
            DELETE FROM mutual_fund_trades WHERE id = v_mf_trade.id;
        END IF;
    ELSIF v_log.source_type = 'goal' THEN
        UPDATE goals SET current_amount = current_amount - v_log.amount WHERE id = v_log.source_id;
    ELSIF v_log.source_type = 'transfer' THEN
        FOR v_sub_log IN SELECT * FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id LOOP
            SELECT balance INTO v_curr_bal FROM accounts WHERE id = v_sub_log.account_id FOR UPDATE;
            UPDATE accounts SET balance = v_curr_bal + (CASE WHEN v_sub_log.action_type = 'TRANSFER_OUT' THEN v_sub_log.amount ELSE -v_sub_log.amount END) WHERE id = v_sub_log.account_id;
        END LOOP;
        DELETE FROM transfers WHERE id = v_log.source_id;
        DELETE FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id;
    ELSIF v_log.source_type = 'income' THEN DELETE FROM incomes WHERE id = v_log.source_id;
    ELSIF v_log.source_type = 'expense' THEN DELETE FROM expenses WHERE id = v_log.source_id;
    END IF;

    -- Cleanup Transactions
    DELETE FROM transactions WHERE ledger_log_id = p_log_id;

    -- restore Balance
    SELECT balance INTO v_curr_bal FROM accounts WHERE id = v_log.account_id FOR UPDATE;
    IF FOUND THEN
        v_rev_amt := CASE WHEN v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY') THEN v_log.amount WHEN v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN', 'SEND_MONEY_IN') THEN -v_log.amount ELSE 0 END;
        UPDATE accounts SET balance = v_curr_bal + v_rev_amt WHERE id = v_log.account_id;
    END IF;

    DELETE FROM ledger_logs WHERE id = p_log_id;
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. SECURITY SEAL
ALTER FUNCTION record_income SECURITY DEFINER;
ALTER FUNCTION record_expense SECURITY DEFINER;
ALTER FUNCTION process_family_transfer SECURITY DEFINER;
ALTER FUNCTION record_investment SECURITY DEFINER;
ALTER FUNCTION revert_ledger_log SECURITY DEFINER;
ALTER FUNCTION adjust_account_balance SECURITY DEFINER;
ALTER FUNCTION record_mf_investment_v4 SECURITY DEFINER;
ALTER FUNCTION contribute_to_goal SECURITY DEFINER;

