-- Migration: Add charges tracking to F&O Trades
-- Date: 2026-06-27
-- Purpose: Add charges column to fno_trades table and update fno_log_trade to accept and process charges.

-- 1. Add charges column to public.fno_trades table
ALTER TABLE public.fno_trades ADD COLUMN IF NOT EXISTS charges NUMERIC(14, 2) DEFAULT 0.00 NOT NULL;

-- 2. Drop the existing fno_log_trade function signature to avoid overload conflicts
DROP FUNCTION IF EXISTS public.fno_log_trade(UUID, TEXT, TEXT, NUMERIC, DATE, TEXT, NUMERIC, NUMERIC, UUID, TEXT, DATE);

-- 3. Re-create fno_log_trade with p_charges support
CREATE OR REPLACE FUNCTION public.fno_log_trade(
    p_user_id UUID,
    p_symbol TEXT,
    p_instrument_type TEXT,
    p_strike_price NUMERIC,
    p_expiry_date DATE,
    p_trade_type TEXT,
    p_quantity NUMERIC(18,6),
    p_entry_price NUMERIC,
    p_account_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_trade_date DATE DEFAULT CURRENT_DATE,
    p_charges NUMERIC DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
    v_old_bal NUMERIC := 0;
    v_acc_name TEXT := 'Suspense';
    v_premium NUMERIC;
    v_total_amount NUMERIC;
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
    IF p_charges < 0 THEN
        RAISE EXCEPTION 'Charges cannot be negative';
    END IF;

    v_premium := p_quantity * p_entry_price;
    v_total_amount := CASE WHEN p_trade_type = 'BUY' THEN v_premium + p_charges ELSE v_premium - p_charges END;

    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
        
        IF p_trade_type = 'BUY' THEN
            IF v_old_bal < v_total_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
            UPDATE accounts SET balance = balance - v_total_amount WHERE id = p_account_id;
        ELSE
            UPDATE accounts SET balance = balance + v_total_amount WHERE id = p_account_id;
        END IF;
    END IF;

    v_details := p_trade_type || ' ' || p_quantity || ' ' || p_symbol || ' ' || p_instrument_type || 
                 CASE WHEN p_strike_price IS NOT NULL THEN ' ' || p_strike_price ELSE '' END || 
                 ' Exp ' || to_char(p_expiry_date, 'YYYY-MM-DD');

    -- Pre-generate IDs to avoid UPDATE on ledger_logs (immutability)
    v_trade_id := gen_random_uuid();
    
    IF p_account_id IS NOT NULL THEN
        v_log_id := gen_random_uuid();
        INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (
            v_log_id, p_user_id, p_account_id, v_acc_name, 
            CASE WHEN p_trade_type = 'BUY' THEN 'ADJUST_DOWN' ELSE 'ADJUST_UP' END, 
            ABS(v_total_amount), v_old_bal, 
            CASE WHEN p_trade_type = 'BUY' THEN v_old_bal - v_total_amount ELSE v_old_bal + v_total_amount END, 
            'FnO Position opened: ' || v_details || ' (Premium: ₹' || v_premium || ', Charges: ₹' || p_charges || ')', v_trade_id, 'fno_trade'
        );
    END IF;

    INSERT INTO fno_trades (
        id, user_id, symbol, instrument_type, strike_price, expiry_date, 
        trade_type, quantity, entry_price, status, account_id, ledger_log_id, notes, trade_date, charges
    ) VALUES (
        v_trade_id, p_user_id, UPPER(p_symbol), UPPER(p_instrument_type), p_strike_price, p_expiry_date, 
        p_trade_type, p_quantity, p_entry_price, 'OPEN', p_account_id, v_log_id, p_notes, p_trade_date, p_charges
    );

    IF p_account_id IS NOT NULL THEN
        INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (
            p_user_id, p_account_id, 'FnO Open: ' || v_details || CASE WHEN p_charges > 0 THEN ' (incl. ₹' || p_charges || ' charges)' ELSE '' END, ABS(v_total_amount), 
            CASE WHEN p_trade_type = 'BUY' THEN 'expense' ELSE 'income' END, 
            'Investments', p_trade_date, v_trade_id, 'fno_trade', v_log_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'trade_id', v_trade_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;
