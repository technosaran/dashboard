-- Migration: Add Futures & Options (FnO) Trades tracking table and update get_investments_v1 / reset_user_data
-- Date: 2026-05-30

CREATE TABLE IF NOT EXISTS public.fno_trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    symbol TEXT NOT NULL,
    instrument_type TEXT NOT NULL CHECK (instrument_type IN ('FUT', 'CE', 'PE')),
    strike_price NUMERIC(14, 2),
    expiry_date DATE NOT NULL,
    trade_type TEXT NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
    quantity NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
    entry_price NUMERIC(14, 2) NOT NULL CHECK (entry_price >= 0),
    exit_price NUMERIC(14, 2) CHECK (exit_price >= 0),
    pnl NUMERIC(14, 2),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    ledger_log_id UUID REFERENCES public.ledger_logs(id) ON DELETE SET NULL,
    close_ledger_log_id UUID REFERENCES public.ledger_logs(id) ON DELETE SET NULL,
    notes TEXT,
    trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
    close_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.fno_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own fno trades"
    ON public.fno_trades FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE fno_trades;

-- Indexing
CREATE INDEX IF NOT EXISTS idx_fno_trades_user_id ON public.fno_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_fno_trades_status ON public.fno_trades(status);
CREATE INDEX IF NOT EXISTS idx_fno_trades_symbol ON public.fno_trades(symbol);

-- Stored Procedure: Log FnO Trade (Open position)
CREATE OR REPLACE FUNCTION public.fno_log_trade(
    p_user_id UUID,
    p_symbol TEXT,
    p_instrument_type TEXT,
    p_strike_price NUMERIC,
    p_expiry_date DATE,
    p_trade_type TEXT,
    p_quantity NUMERIC,
    p_entry_price NUMERIC,
    p_account_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_trade_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
    v_premium NUMERIC;
    v_old_bal NUMERIC := 0;
    v_acc_name TEXT := 'Suspense';
    v_log_id UUID := NULL;
    v_trade_id UUID;
    v_details TEXT;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    IF p_quantity <= 0 OR p_entry_price < 0 THEN 
        RAISE EXCEPTION 'Invalid quantity or price'; 
    END IF;

    v_premium := p_quantity * p_entry_price;

    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
        
        IF p_trade_type = 'BUY' THEN
            IF v_old_bal < v_premium THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
            UPDATE accounts SET balance = balance - v_premium WHERE id = p_account_id;
        ELSE
            UPDATE accounts SET balance = balance + v_premium WHERE id = p_account_id;
        END IF;
    END IF;

    -- Create trade details string
    v_details := p_trade_type || ' ' || p_quantity || ' ' || p_symbol || ' ' || p_instrument_type || 
                 CASE WHEN p_strike_price IS NOT NULL THEN ' ' || p_strike_price ELSE '' END || 
                 ' Exp ' || to_char(p_expiry_date, 'YYYY-MM-DD');

    -- Insert ledger log if account is linked
    IF p_account_id IS NOT NULL THEN
        INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_type)
        VALUES (
            p_user_id, 
            p_account_id, 
            v_acc_name, 
            CASE WHEN p_trade_type = 'BUY' THEN 'ADJUST_DOWN' ELSE 'ADJUST_UP' END, 
            v_premium, 
            v_old_bal, 
            CASE WHEN p_trade_type = 'BUY' THEN v_old_bal - v_premium ELSE v_old_bal + v_premium END, 
            'FnO Position opened: ' || v_details, 
            'fno_trade'
        ) RETURNING id INTO v_log_id;
    END IF;

    -- Insert FnO Trade
    INSERT INTO fno_trades (
        user_id, symbol, instrument_type, strike_price, expiry_date, 
        trade_type, quantity, entry_price, status, account_id, ledger_log_id, notes, trade_date
    ) VALUES (
        p_user_id, UPPER(p_symbol), UPPER(p_instrument_type), p_strike_price, p_expiry_date, 
        p_trade_type, p_quantity, p_entry_price, 'OPEN', p_account_id, v_log_id, p_notes, p_trade_date
    ) RETURNING id INTO v_trade_id;

    -- Link ledger log source_id
    IF v_log_id IS NOT NULL THEN
        UPDATE ledger_logs SET source_id = v_trade_id WHERE id = v_log_id;
        
        -- Insert a financial transaction
        INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (
            p_user_id, 
            p_account_id, 
            'FnO Open: ' || v_details, 
            v_premium, 
            CASE WHEN p_trade_type = 'BUY' THEN 'expense' else 'income' END, 
            'Investments', 
            p_trade_date, 
            v_trade_id, 
            'fno_trade', 
            v_log_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'trade_id', v_trade_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Stored Procedure: Close FnO Position
CREATE OR REPLACE FUNCTION public.fno_close_position(
    p_user_id UUID,
    p_trade_id UUID,
    p_exit_price NUMERIC,
    p_close_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
    v_trade RECORD;
    v_pnl NUMERIC;
    v_exit_val NUMERIC;
    v_old_bal NUMERIC := 0;
    v_acc_name TEXT;
    v_log_id UUID := NULL;
    v_details TEXT;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    IF p_exit_price < 0 THEN 
        RAISE EXCEPTION 'Invalid exit price'; 
    END IF;

    SELECT * INTO v_trade FROM fno_trades WHERE id = p_trade_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Trade not found'; END IF;
    IF v_trade.status = 'CLOSED' THEN RAISE EXCEPTION 'Trade already closed'; END IF;

    -- Compute realized P&L
    IF v_trade.trade_type = 'BUY' THEN
        v_pnl := (p_exit_price - v_trade.entry_price) * v_trade.quantity;
    ELSE
        v_pnl := (v_trade.entry_price - p_exit_price) * v_trade.quantity;
    END IF;

    v_exit_val := v_trade.quantity * p_exit_price;

    -- Adjust linked account if applicable
    IF v_trade.account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = v_trade.account_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            -- BUY: premium paid initially. closing premium received = v_exit_val (credits account)
            -- SELL: premium received initially. closing premium paid = v_exit_val (debits account)
            IF v_trade.trade_type = 'BUY' THEN
                UPDATE accounts SET balance = balance + v_exit_val WHERE id = v_trade.account_id;
            ELSE
                IF v_old_bal < v_exit_val THEN RAISE EXCEPTION 'Insufficient balance to buy back position'; END IF;
                UPDATE accounts SET balance = balance - v_exit_val WHERE id = v_trade.account_id;
            END IF;
        END IF;
    END IF;

    v_details := v_trade.trade_type || ' ' || v_trade.quantity || ' ' || v_trade.symbol || ' Closed @ ' || p_exit_price;

    -- Insert close ledger log
    IF v_trade.account_id IS NOT NULL AND v_acc_name IS NOT NULL THEN
        INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (
            p_user_id, 
            v_trade.account_id, 
            v_acc_name, 
            CASE WHEN v_trade.trade_type = 'BUY' THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END, 
            v_exit_val, 
            v_old_bal, 
            CASE WHEN v_trade.trade_type = 'BUY' THEN v_old_bal + v_exit_val ELSE v_old_bal - v_exit_val END, 
            'FnO Position closed: ' || v_details || ' (Realized P&L: ' || v_pnl || ')', 
            v_trade.id, 
            'fno_trade'
        ) RETURNING id INTO v_log_id;

        -- Insert a financial transaction
        INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (
            p_user_id, 
            v_trade.account_id, 
            'FnO Close: ' || v_details, 
            v_exit_val, 
            CASE WHEN v_trade.trade_type = 'BUY' THEN 'income' else 'expense' END, 
            'Investments', 
            p_close_date, 
            v_trade.id, 
            'fno_trade', 
            v_log_id
        );
    END IF;

    -- Update trade to CLOSED status
    UPDATE fno_trades 
    SET status = 'CLOSED',
        exit_price = p_exit_price,
        close_date = p_close_date,
        pnl = v_pnl,
        close_ledger_log_id = v_log_id,
        updated_at = NOW()
    WHERE id = p_trade_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Stored Procedure: Revert and Delete FnO Trade
CREATE OR REPLACE FUNCTION public.fno_delete_trade(
    p_user_id UUID,
    p_trade_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_trade RECORD;
    v_opening_premium NUMERIC;
    v_closing_exit NUMERIC;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;

    SELECT * INTO v_trade FROM fno_trades WHERE id = p_trade_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Trade not found'; END IF;

    -- Revert closing premium flow if trade is CLOSED and had an account
    IF v_trade.status = 'CLOSED' AND v_trade.account_id IS NOT NULL THEN
        v_closing_exit := v_trade.quantity * v_trade.exit_price;
        -- If BUY: closing credited balance (revert by deducting)
        -- If SELL: closing debited balance (revert by crediting)
        IF v_trade.trade_type = 'BUY' THEN
            UPDATE accounts SET balance = balance - v_closing_exit WHERE id = v_trade.account_id;
        ELSE
            UPDATE accounts SET balance = balance + v_closing_exit WHERE id = v_trade.account_id;
        END IF;
    END IF;

    -- Revert opening premium flow if trade had an account
    IF v_trade.account_id IS NOT NULL THEN
        v_opening_premium := v_trade.quantity * v_trade.entry_price;
        -- If BUY: opening debited balance (revert by crediting)
        -- If SELL: opening credited balance (revert by deducting)
        IF v_trade.trade_type = 'BUY' THEN
            UPDATE accounts SET balance = balance + v_opening_premium WHERE id = v_trade.account_id;
        ELSE
            UPDATE accounts SET balance = balance - v_opening_premium WHERE id = v_trade.account_id;
        END IF;
    END IF;

    -- Delete associated ledger logs & transactions
    DELETE FROM transactions WHERE source_id = p_trade_id AND source_type = 'fno_trade' AND user_id = p_user_id;
    DELETE FROM ledger_logs WHERE source_id = p_trade_id AND source_type = 'fno_trade' AND user_id = p_user_id;

    -- Delete trade
    DELETE FROM fno_trades WHERE id = p_trade_id AND user_id = p_user_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Update get_investments_v1()
CREATE OR REPLACE FUNCTION get_investments_v1()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT json_build_object(
        'investments', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.investments WHERE user_id = v_user_id ORDER BY current_price * quantity DESC) t),
        'mutualFunds', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.mutual_funds WHERE user_id = v_user_id) t),
        'bonds', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.bonds WHERE user_id = v_user_id ORDER BY maturity_date ASC) t),
        'alternativeAssets', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.alternative_assets WHERE user_id = v_user_id ORDER BY current_value DESC) t),
        'stockTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.stock_trades WHERE user_id = v_user_id ORDER BY trade_date DESC LIMIT 50) t),
        'mutualFundTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.mutual_fund_trades WHERE user_id = v_user_id ORDER BY date DESC LIMIT 50) t),
        'bondTransactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.bond_transactions WHERE user_id = v_user_id ORDER BY transaction_date DESC LIMIT 50) t),
        'fnoTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.fno_trades WHERE user_id = v_user_id ORDER BY trade_date DESC, created_at DESC) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update reset_user_data
CREATE OR REPLACE FUNCTION reset_user_data(p_user_id UUID) RETURNS JSON AS $$
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;

    -- Delete in order to respect FK constraints if any
    DELETE FROM public.bond_transactions WHERE user_id = p_user_id;
    DELETE FROM public.bonds WHERE user_id = p_user_id;
    DELETE FROM public.forex_transactions WHERE user_id = p_user_id;
    DELETE FROM public.forex_trades WHERE user_id = p_user_id;
    DELETE FROM public.forex_accounts WHERE user_id = p_user_id;
    DELETE FROM public.fno_trades WHERE user_id = p_user_id;
    DELETE FROM public.alternative_assets WHERE user_id = p_user_id;
    DELETE FROM public.liabilities WHERE user_id = p_user_id;
    DELETE FROM public.budgets WHERE user_id = p_user_id;
    DELETE FROM public.net_worth_snapshots WHERE user_id = p_user_id;
    
    DELETE FROM public.stock_trades WHERE user_id = p_user_id;
    DELETE FROM public.investments WHERE user_id = p_user_id;
    DELETE FROM public.mutual_fund_trades WHERE user_id = p_user_id;
    DELETE FROM public.mutual_funds WHERE user_id = p_user_id;
    
    DELETE FROM public.transactions WHERE user_id = p_user_id;
    DELETE FROM public.ledger_logs WHERE user_id = p_user_id;
    DELETE FROM public.transfers WHERE user_id = p_user_id;
    DELETE FROM public.expenses WHERE user_id = p_user_id;
    DELETE FROM public.incomes WHERE user_id = p_user_id;
    DELETE FROM public.goals WHERE user_id = p_user_id;
    DELETE FROM public.recipients WHERE user_id = p_user_id;
    DELETE FROM public.accounts WHERE user_id = p_user_id;

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant EXECUTE permission to authenticated role
GRANT EXECUTE ON FUNCTION get_investments_v1() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fno_log_trade(UUID, TEXT, TEXT, NUMERIC, DATE, TEXT, NUMERIC, NUMERIC, UUID, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fno_close_position(UUID, UUID, NUMERIC, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION fno_delete_trade(UUID, UUID) TO authenticated;
