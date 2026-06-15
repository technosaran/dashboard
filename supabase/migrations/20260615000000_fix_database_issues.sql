-- Migration: Fix Database Issues (Adjust balance source ID mapping & Optional MF Account)
-- Date: 2026-06-15

-- 1. Drop existing functions to avoid signature overload conflicts
DROP FUNCTION IF EXISTS public.adjust_account_balance(UUID, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.adjust_account_balance(UUID, UUID, NUMERIC, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.record_mf_investment_v4(UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, DATE, UUID, NUMERIC, TEXT);

-- 2. CREATE FUNCTION: adjust_account_balance (Updated to accept source details)
CREATE OR REPLACE FUNCTION public.adjust_account_balance(
    p_user_id UUID,
    p_account_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT 'Manual balance adjustment',
    p_source_id UUID DEFAULT NULL,
    p_source_type TEXT DEFAULT 'transaction'
) RETURNS JSONB AS $$
DECLARE v_old_bal NUMERIC; v_acc_name TEXT; v_txn_id UUID; v_log_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;

    UPDATE accounts SET balance = balance + p_amount WHERE id = p_account_id;
    
    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_type)
    VALUES (p_user_id, p_account_id, v_acc_name, CASE WHEN p_amount >= 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END, ABS(p_amount), v_old_bal, v_old_bal + p_amount, COALESCE(p_note, 'Manual adjustment'), COALESCE(p_source_type, 'transaction'))
    RETURNING id INTO v_log_id;

    INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
    VALUES (p_user_id, p_account_id, COALESCE(p_note, 'Balance adjustment'), ABS(p_amount), CASE WHEN p_amount >= 0 THEN 'income' ELSE 'expense' END, 'Adjustments', CURRENT_DATE, COALESCE(p_source_id, v_log_id), COALESCE(p_source_type, 'transaction'), v_log_id)
    RETURNING id INTO v_txn_id;

    UPDATE ledger_logs SET source_id = COALESCE(p_source_id, v_txn_id) WHERE id = v_log_id;

    RETURN jsonb_build_object('success', true, 'new_balance', v_old_bal + p_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. CREATE FUNCTION: record_mf_investment_v4 (Updated to handle optional accounts)
CREATE OR REPLACE FUNCTION public.record_mf_investment_v4(
    p_user_id UUID, p_fund_name TEXT, p_scheme_code TEXT, p_units NUMERIC, p_nav NUMERIC, p_investment_type TEXT, p_category TEXT, p_amc_name TEXT, p_date DATE, p_account_id UUID, p_stamp_duty NUMERIC DEFAULT 0, p_trade_type TEXT DEFAULT 'buy'
) RETURNS JSONB AS $$
DECLARE v_mf_id UUID; v_total NUMERIC; v_old_bal NUMERIC := 0; v_acc_name TEXT := 'Suspense'; v_log_id UUID; v_exist RECORD; v_pnl NUMERIC := 0;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF p_units <= 0 THEN RAISE EXCEPTION 'Units must be positive'; END IF;

    v_total := CASE WHEN p_trade_type = 'buy' THEN (p_units * p_nav) + p_stamp_duty ELSE (p_units * p_nav) - p_stamp_duty END;

    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
        IF p_trade_type = 'buy' AND v_old_bal < v_total THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    END IF;

    SELECT * INTO v_exist FROM mutual_funds WHERE user_id = p_user_id AND fund_symbol = p_scheme_code FOR UPDATE;

    IF p_trade_type = 'buy' THEN
        IF v_exist IS NOT NULL THEN
            UPDATE mutual_funds SET units = units + p_units, avg_nav = ((units * avg_nav) + v_total) / (units + p_units), current_nav = p_nav, updated_at = NOW() WHERE id = v_exist.id;
            v_mf_id := v_exist.id;
        ELSE
            INSERT INTO mutual_funds (user_id, fund_name, fund_symbol, units, avg_nav, current_nav, investment_type, category, amc_name)
            VALUES (p_user_id, p_fund_name, p_scheme_code, p_units, v_total / p_units, p_nav, p_investment_type, p_category, p_amc_name) RETURNING id INTO v_mf_id;
        END IF;
    ELSE
        IF v_exist IS NULL OR v_exist.units < p_units THEN RAISE EXCEPTION 'Insufficient units'; END IF;
        v_pnl := v_total - (v_exist.avg_nav * p_units);
        UPDATE mutual_funds SET units = units - p_units, realized_pnl = COALESCE(realized_pnl, 0) + v_pnl, current_nav = p_nav, updated_at = NOW() WHERE id = v_exist.id;
        v_mf_id := v_exist.id;
    END IF;

    IF p_account_id IS NOT NULL THEN
        UPDATE accounts SET balance = CASE WHEN p_trade_type = 'buy' THEN balance - v_total ELSE balance + v_total END WHERE id = p_account_id;

        INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (p_user_id, p_account_id, v_acc_name, CASE WHEN p_trade_type = 'buy' THEN 'ADJUST_DOWN' ELSE 'ADJUST_UP' END, v_total, v_old_bal, CASE WHEN p_trade_type = 'buy' THEN v_old_bal - v_total ELSE v_old_bal + v_total END, (CASE WHEN p_trade_type = 'buy' THEN 'Subscribed ' ELSE 'Redeemed ' END) || p_units || ' units in ' || p_fund_name, v_mf_id, 'mutual_fund')
        RETURNING id INTO v_log_id;

        INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (p_user_id, p_account_id, (CASE WHEN p_trade_type = 'buy' THEN 'MF Buy: ' ELSE 'MF Sell: ' END) || p_fund_name, v_total, CASE WHEN p_trade_type = 'buy' THEN 'expense' ELSE 'income' END, 'Investments', p_date, v_mf_id, 'mutual_fund', v_log_id);
    ELSE
        -- Log to ledger without account details
        INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (p_user_id, NULL, v_acc_name, CASE WHEN p_trade_type = 'buy' THEN 'ADJUST_DOWN' ELSE 'ADJUST_UP' END, v_total, 0, 0, (CASE WHEN p_trade_type = 'buy' THEN 'Subscribed (Log Only) ' ELSE 'Redeemed (Log Only) ' END) || p_units || ' units in ' || p_fund_name, v_mf_id, 'mutual_fund')
        RETURNING id INTO v_log_id;
    END IF;

    INSERT INTO mutual_fund_trades (user_id, mf_id, fund_name, trade_type, units, nav, amount, date, ledger_log_id, realized_pnl)
    VALUES (p_user_id, v_mf_id, p_fund_name, UPPER(p_trade_type), p_units, p_nav, v_total, p_date, v_log_id, v_pnl);

    RETURN jsonb_build_object('success', true, 'mf_id', v_mf_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. GRANTS AND ROLES REVOCATION (Matches standard security hardening protocol)
REVOKE EXECUTE ON FUNCTION public.adjust_account_balance(UUID, UUID, NUMERIC, TEXT, UUID, TEXT) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.record_mf_investment_v4(UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, DATE, UUID, NUMERIC, TEXT) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.adjust_account_balance(UUID, UUID, NUMERIC, TEXT, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_mf_investment_v4(UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, DATE, UUID, NUMERIC, TEXT) TO authenticated, service_role;
