-- Migration: Fix FnO Trade Immutability Violation
-- Purpose: Pre-generate IDs to avoid updating ledger_logs, bypassing the BEFORE UPDATE immutability check.

CREATE OR REPLACE FUNCTION public.fno_log_trade(
    p_user_id UUID,
    p_symbol TEXT,
    p_instrument_type TEXT,
    p_strike_price NUMERIC,
    p_expiry_date DATE,
    p_trade_type TEXT,
    p_quantity INTEGER,
    p_entry_price NUMERIC,
    p_account_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_trade_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
    v_old_bal NUMERIC := 0;
    v_acc_name TEXT := 'Suspense';
    v_premium NUMERIC;
    v_trade_id UUID;
    v_log_id UUID := NULL;
    v_details TEXT;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    IF p_quantity <= 0 OR p_entry_price <= 0 THEN 
        RAISE EXCEPTION 'Invalid quantity or entry price'; 
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

    -- Pre-generate IDs to link them natively during INSERT (avoiding UPDATE on ledger_logs)
    v_trade_id := gen_random_uuid();
    
    -- Insert ledger log if account is linked
    IF p_account_id IS NOT NULL THEN
        v_log_id := gen_random_uuid();
        INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (
            v_log_id,
            p_user_id, 
            p_account_id, 
            v_acc_name, 
            CASE WHEN p_trade_type = 'BUY' THEN 'ADJUST_DOWN' ELSE 'ADJUST_UP' END, 
            v_premium, 
            v_old_bal, 
            CASE WHEN p_trade_type = 'BUY' THEN v_old_bal - v_premium ELSE v_old_bal + v_premium END, 
            'FnO Position opened: ' || v_details, 
            v_trade_id,
            'fno_trade'
        );
    END IF;

    -- Insert FnO Trade
    INSERT INTO fno_trades (
        id, user_id, symbol, instrument_type, strike_price, expiry_date, 
        trade_type, quantity, entry_price, status, account_id, ledger_log_id, notes, trade_date
    ) VALUES (
        v_trade_id, p_user_id, UPPER(p_symbol), UPPER(p_instrument_type), p_strike_price, p_expiry_date, 
        p_trade_type, p_quantity, p_entry_price, 'OPEN', p_account_id, v_log_id, p_notes, p_trade_date
    );

    -- Insert a financial transaction
    IF p_account_id IS NOT NULL THEN
        INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (
            p_user_id, 
            p_account_id, 
            'FnO Open: ' || v_details, 
            v_premium, 
            CASE WHEN p_trade_type = 'BUY' THEN 'expense' ELSE 'income' END, 
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
