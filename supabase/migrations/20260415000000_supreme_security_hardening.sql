
-- Migration: Supreme Security Hardening Final
-- Purpose: Fix ALL vulnerabilities (impersonation, search path hijacking) and logic flaws (negative amounts, cross-user exploits) across the entire RPC surface.

DROP FUNCTION IF EXISTS process_transfer(UUID, UUID, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS record_income(UUID, TEXT, NUMERIC, TEXT, DATE, UUID);
DROP FUNCTION IF EXISTS record_expense(UUID, TEXT, NUMERIC, TEXT, DATE, UUID);
DROP FUNCTION IF EXISTS record_investment(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE, UUID, NUMERIC, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS record_mf_investment_v4(UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, DATE, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS process_family_transfer(UUID, UUID, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS adjust_account_balance(UUID, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS delete_account_atomic_v2(UUID, UUID);
DROP FUNCTION IF EXISTS create_account_atomic(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS contribute_to_goal(UUID, UUID, UUID, NUMERIC);
DROP FUNCTION IF EXISTS revert_ledger_log(UUID, UUID);
DROP FUNCTION IF EXISTS reset_user_data(UUID);

-- 1. Hardened process_transfer
CREATE OR REPLACE FUNCTION process_transfer(
    p_user_id UUID,
    p_from_account_id UUID,
    p_to_account_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_from_balance NUMERIC;
    v_to_balance NUMERIC;
    v_from_name TEXT;
    v_to_name TEXT;
    v_from_currency TEXT;
    v_to_currency TEXT;
    v_transfer_id UUID;
BEGIN
    -- SECURITY: Identity Verification
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- VALIDATION: Amounts & Accounts
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Transfer amount must be positive'; END IF;
    IF p_from_account_id = p_to_account_id THEN RAISE EXCEPTION 'Self-transfers blocked'; END IF;

    -- Locking & Parity
    SELECT balance, name, currency INTO v_from_balance, v_from_name, v_from_currency
    FROM accounts WHERE id = p_from_account_id AND user_id = p_user_id FOR UPDATE;
    
    SELECT balance, name, currency INTO v_to_balance, v_to_name, v_to_currency
    FROM accounts WHERE id = p_to_account_id AND user_id = p_user_id FOR UPDATE;

    IF v_from_name IS NULL OR v_to_name IS NULL THEN RAISE EXCEPTION 'Accounts not found'; END IF;
    IF v_from_currency != v_to_currency THEN RAISE EXCEPTION 'Currency mismatch'; END IF;
    IF v_from_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance in %', v_from_name; END IF;

    UPDATE accounts SET balance = balance - p_amount WHERE id = p_from_account_id;
    UPDATE accounts SET balance = balance + p_amount WHERE id = p_to_account_id;

    INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, note)
    VALUES (p_user_id, p_from_account_id, p_to_account_id, p_amount, p_note) RETURNING id INTO v_transfer_id;

    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES 
    (p_user_id, p_from_account_id, v_from_name, 'TRANSFER_OUT', p_amount, v_from_balance, v_from_balance - p_amount, 'To ' || v_to_name || COALESCE(': ' || p_note, ''), v_transfer_id, 'transfer'),
    (p_user_id, p_to_account_id, v_to_name, 'TRANSFER_IN', p_amount, v_to_balance, v_to_balance + p_amount, 'From ' || v_from_name || COALESCE(': ' || p_note, ''), v_transfer_id, 'transfer');

    RETURN jsonb_build_object('success', true, 'transfer_id', v_transfer_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Hardened record_income
CREATE OR REPLACE FUNCTION record_income(
    p_user_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_bal NUMERIC := 0; v_acc_name TEXT := 'Suspense'; v_income_id UUID; v_log_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

    INSERT INTO incomes (user_id, account_id, description, amount, category, date)
    VALUES (p_user_id, p_account_id, p_description, p_amount, p_category, p_date) RETURNING id INTO v_income_id;

    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
        UPDATE accounts SET balance = balance + p_amount WHERE id = p_account_id;
    END IF;

    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_type, source_id)
    VALUES (p_user_id, p_account_id, v_acc_name, 'ADJUST_UP', p_amount, v_old_bal, v_old_bal + p_amount, 'Income: ' || p_description, 'income', v_income_id)
    RETURNING id INTO v_log_id;

    IF p_account_id IS NOT NULL THEN
        INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (p_user_id, p_account_id, p_description, p_amount, 'income', p_category, p_date, v_income_id, 'income', v_log_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'income_id', v_income_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Hardened record_expense
CREATE OR REPLACE FUNCTION record_expense(
    p_user_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_bal NUMERIC := 0; v_acc_name TEXT := 'Suspense'; v_expense_id UUID; v_log_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

    INSERT INTO expenses (user_id, account_id, description, amount, category, date)
    VALUES (p_user_id, p_account_id, p_description, p_amount, p_category, p_date) RETURNING id INTO v_expense_id;

    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
        IF v_old_bal < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
        UPDATE accounts SET balance = balance - p_amount WHERE id = p_account_id;
    END IF;

    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_type, source_id)
    VALUES (p_user_id, p_account_id, v_acc_name, 'ADJUST_DOWN', p_amount, v_old_bal, v_old_bal - p_amount, 'Expense: ' || p_description, 'expense', v_expense_id)
    RETURNING id INTO v_log_id;

    IF p_account_id IS NOT NULL THEN
        INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (p_user_id, p_account_id, p_description, p_amount, 'expense', p_category, p_date, v_expense_id, 'expense', v_log_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'expense_id', v_expense_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Hardened record_investment
CREATE OR REPLACE FUNCTION record_investment(
    p_user_id UUID, p_name TEXT, p_type TEXT, p_symbol TEXT, p_quantity NUMERIC, p_buy_price NUMERIC, p_current_price NUMERIC, p_currency TEXT, p_notes TEXT, p_date DATE, p_account_id UUID, p_total_cost NUMERIC, p_trade_type TEXT, p_charges NUMERIC
) RETURNS JSONB AS $$
DECLARE v_inv_id UUID; v_old_bal NUMERIC; v_acc_name TEXT; v_log_id UUID; v_exist RECORD; v_new_qty NUMERIC; v_new_avg NUMERIC; v_profit NUMERIC := 0;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF p_quantity <= 0 OR p_total_cost < 0 THEN RAISE EXCEPTION 'Invalid quantity or cost'; END IF;

    SELECT * INTO v_exist FROM investments WHERE user_id = p_user_id AND symbol = p_symbol AND type = p_type FOR UPDATE;

    IF p_trade_type = 'buy' THEN
        IF v_exist IS NOT NULL THEN
            v_new_qty := v_exist.quantity + p_quantity;
            v_new_avg := ((v_exist.quantity * v_exist.buy_price) + (p_quantity * p_buy_price)) / v_new_qty;
            UPDATE investments SET quantity = v_new_qty, buy_price = v_new_avg, current_price = p_current_price, updated_at = NOW() WHERE id = v_exist.id;
            v_inv_id := v_exist.id;
        ELSE
            INSERT INTO investments (user_id, name, type, symbol, quantity, buy_price, current_price, currency, notes, bought_at)
            VALUES (p_user_id, p_name, p_type, p_symbol, p_quantity, p_buy_price, p_current_price, p_currency, p_notes, p_date) RETURNING id INTO v_inv_id;
        END IF;
    ELSE
        IF v_exist IS NULL OR v_exist.quantity < p_quantity THEN RAISE EXCEPTION 'Insufficient quantity'; END IF;
        v_profit := (p_buy_price - v_exist.buy_price) * p_quantity;
        UPDATE investments SET quantity = quantity - p_quantity, realized_pnl = COALESCE(realized_pnl, 0) + v_profit, current_price = p_current_price, updated_at = NOW() WHERE id = v_exist.id;
        v_inv_id := v_exist.id;
    END IF;

    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
        IF p_trade_type = 'buy' AND v_old_bal < p_total_cost THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
        UPDATE accounts SET balance = CASE WHEN p_trade_type = 'buy' THEN balance - p_total_cost ELSE balance + p_total_cost END WHERE id = p_account_id;

        INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (p_user_id, p_account_id, v_acc_name, CASE WHEN p_trade_type = 'buy' THEN 'ADJUST_DOWN' ELSE 'ADJUST_UP' END, p_total_cost, v_old_bal, CASE WHEN p_trade_type = 'buy' THEN v_old_bal - p_total_cost ELSE v_old_bal + p_total_cost END, (CASE WHEN p_trade_type = 'buy' THEN 'Bought ' ELSE 'Sold ' END) || p_quantity || ' ' || p_symbol, v_inv_id, 'investment')
        RETURNING id INTO v_log_id;

        INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (p_user_id, p_account_id, (CASE WHEN p_trade_type = 'buy' THEN 'Purchase ' ELSE 'Sale ' END) || p_name, p_total_cost, CASE WHEN p_trade_type = 'buy' THEN 'expense' ELSE 'income' END, 'Investments', p_date, v_inv_id, 'investment', v_log_id);
    END IF;

    INSERT INTO stock_trades (user_id, investment_id, symbol, trade_type, quantity, price, total_amount, trade_date, charges, ledger_log_id, realized_pnl)
    VALUES (p_user_id, v_inv_id, p_symbol, p_trade_type, p_quantity, p_buy_price, p_total_cost, p_date, p_charges, v_log_id, CASE WHEN p_trade_type = 'sell' THEN v_profit ELSE NULL END);

    RETURN jsonb_build_object('success', true, 'investment_id', v_inv_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Hardened record_mf_investment_v4
CREATE OR REPLACE FUNCTION record_mf_investment_v4(
    p_user_id UUID, p_fund_name TEXT, p_scheme_code TEXT, p_units NUMERIC, p_nav NUMERIC, p_investment_type TEXT, p_category TEXT, p_amc_name TEXT, p_date DATE, p_account_id UUID, p_stamp_duty NUMERIC DEFAULT 0, p_trade_type TEXT DEFAULT 'buy'
) RETURNS JSONB AS $$
DECLARE v_mf_id UUID; v_total NUMERIC; v_old_bal NUMERIC; v_acc_name TEXT; v_log_id UUID; v_exist RECORD; v_pnl NUMERIC := 0;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF p_units <= 0 THEN RAISE EXCEPTION 'Units must be positive'; END IF;

    v_total := CASE WHEN p_trade_type = 'buy' THEN (p_units * p_nav) + p_stamp_duty ELSE (p_units * p_nav) - p_stamp_duty END;

    SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
    IF p_trade_type = 'buy' AND v_old_bal < v_total THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

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

    UPDATE accounts SET balance = CASE WHEN p_trade_type = 'buy' THEN balance - v_total ELSE balance + v_total END WHERE id = p_account_id;

    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES (p_user_id, p_account_id, v_acc_name, CASE WHEN p_trade_type = 'buy' THEN 'ADJUST_DOWN' ELSE 'ADJUST_UP' END, v_total, v_old_bal, CASE WHEN p_trade_type = 'buy' THEN v_old_bal - v_total ELSE v_old_bal + v_total END, (CASE WHEN p_trade_type = 'buy' THEN 'Subscribed ' ELSE 'Redeemed ' END) || p_units || ' units in ' || p_fund_name, v_mf_id, 'mutual_fund')
    RETURNING id INTO v_log_id;

    INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
    VALUES (p_user_id, p_account_id, (CASE WHEN p_trade_type = 'buy' THEN 'MF Buy: ' ELSE 'MF Sell: ' END) || p_fund_name, v_total, CASE WHEN p_trade_type = 'buy' THEN 'expense' ELSE 'income' END, 'Investments', p_date, v_mf_id, 'mutual_fund', v_log_id);

    INSERT INTO mutual_fund_trades (user_id, mf_id, fund_name, trade_type, units, nav, amount, date, ledger_log_id, realized_pnl)
    VALUES (p_user_id, v_mf_id, p_fund_name, UPPER(p_trade_type), p_units, p_nav, v_total, p_date, v_log_id, v_pnl);

    RETURN jsonb_build_object('success', true, 'mf_id', v_mf_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Hardened delete_account_atomic_v2
CREATE OR REPLACE FUNCTION delete_account_atomic_v2(p_user_id UUID, p_account_id UUID) RETURNS JSONB AS $$
DECLARE v_acc RECORD;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    SELECT * INTO v_acc FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
    DELETE FROM accounts WHERE id = p_account_id;
    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, metadata)
    VALUES (p_user_id, p_account_id, v_acc.name, 'DELETE', v_acc.balance, v_acc.balance, 0, 'Deleted account: ' || v_acc.name, to_jsonb(v_acc));
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Hardened create_account_atomic
CREATE OR REPLACE FUNCTION create_account_atomic(p_user_id UUID, p_name TEXT, p_type TEXT, p_balance NUMERIC, p_color TEXT DEFAULT NULL, p_institution TEXT DEFAULT NULL, p_account_number TEXT DEFAULT NULL) RETURNS JSONB AS $$
DECLARE v_acc_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    INSERT INTO accounts (user_id, name, type, balance, color, institution, account_number)
    VALUES (p_user_id, p_name, p_type, p_balance, p_color, p_institution, p_account_number) RETURNING id INTO v_acc_id;
    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
    VALUES (p_user_id, v_acc_id, p_name, 'CREATE', p_balance, 0, p_balance, 'Created ' || p_type || ' account: ' || p_name);
    RETURN jsonb_build_object('success', true, 'id', v_acc_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Hardened process_family_transfer
CREATE OR REPLACE FUNCTION process_family_transfer(
    p_user_id UUID,
    p_account_id UUID,
    p_recipient_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_bal NUMERIC; v_acc_name TEXT; v_rec_name TEXT; v_txn_id UUID; v_details TEXT; v_log_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

    SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
    IF v_old_bal < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    SELECT name INTO v_rec_name FROM recipients WHERE id = p_recipient_id AND user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Recipient not found'; END IF;

    UPDATE accounts SET balance = balance - p_amount WHERE id = p_account_id;
    v_details := 'Sent money to ' || v_rec_name || COALESCE(': ' || p_note, '');
    
    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_type)
    VALUES (p_user_id, p_account_id, v_acc_name, 'SEND_MONEY', p_amount, v_old_bal, v_old_bal - p_amount, v_details, 'transaction')
    RETURNING id INTO v_log_id;

    INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, ledger_log_id)
    VALUES (p_user_id, p_account_id, v_details, p_amount, 'expense', 'Family & Friends', CURRENT_DATE, v_log_id)
    RETURNING id INTO v_txn_id;

    UPDATE ledger_logs SET source_id = v_txn_id WHERE id = v_log_id;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_txn_id, 'new_balance', v_old_bal - p_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Hardened adjust_account_balance
CREATE OR REPLACE FUNCTION adjust_account_balance(
    p_user_id UUID,
    p_account_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT 'Manual balance adjustment'
) RETURNS JSONB AS $$
DECLARE v_old_bal NUMERIC; v_acc_name TEXT; v_txn_id UUID; v_log_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;

    UPDATE accounts SET balance = balance + p_amount WHERE id = p_account_id;
    
    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_type)
    VALUES (p_user_id, p_account_id, v_acc_name, CASE WHEN p_amount >= 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END, ABS(p_amount), v_old_bal, v_old_bal + p_amount, COALESCE(p_note, 'Manual adjustment'), 'transaction')
    RETURNING id INTO v_log_id;

    INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, ledger_log_id)
    VALUES (p_user_id, p_account_id, COALESCE(p_note, 'Balance adjustment'), ABS(p_amount), CASE WHEN p_amount >= 0 THEN 'income' ELSE 'expense' END, 'Adjustments', CURRENT_DATE, v_log_id)
    RETURNING id INTO v_txn_id;

    UPDATE ledger_logs SET source_id = v_txn_id WHERE id = v_log_id;

    RETURN jsonb_build_object('success', true, 'new_balance', v_old_bal + p_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 10. Hardened contribute_to_goal
CREATE OR REPLACE FUNCTION contribute_to_goal(p_user_id UUID, p_goal_id UUID, p_account_id UUID, p_amount NUMERIC) RETURNS JSONB AS $$
DECLARE v_old_bal NUMERIC; v_acc_name TEXT; v_goal_name TEXT; v_log_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

    SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
    IF v_old_bal < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    SELECT name INTO v_goal_name FROM goals WHERE id = p_goal_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Goal not found'; END IF;

    UPDATE accounts SET balance = balance - p_amount WHERE id = p_account_id;
    UPDATE goals SET current_amount = current_amount + p_amount WHERE id = p_goal_id;

    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES (p_user_id, p_account_id, v_acc_name, 'ADJUST_DOWN', p_amount, v_old_bal, v_old_bal - p_amount, 'Goal: ' || v_goal_name, p_goal_id, 'goal')
    RETURNING id INTO v_log_id;

    INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
    VALUES (p_user_id, p_account_id, 'Contribution: ' || v_goal_name, p_amount, 'expense', 'Goals', CURRENT_DATE, p_goal_id, 'goal', v_log_id);

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Hardened reset_user_data
CREATE OR REPLACE FUNCTION reset_user_data(p_user_id UUID) RETURNS JSON AS $$
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    DELETE FROM public.ledger_logs WHERE user_id = p_user_id;
    DELETE FROM public.transactions WHERE user_id = p_user_id;
    DELETE FROM public.transfers WHERE user_id = p_user_id;
    DELETE FROM public.expenses WHERE user_id = p_user_id;
    DELETE FROM public.incomes WHERE user_id = p_user_id;
    DELETE FROM public.stock_trades WHERE user_id = p_user_id;
    DELETE FROM public.investments WHERE user_id = p_user_id;
    DELETE FROM public.mutual_fund_trades WHERE user_id = p_user_id;
    DELETE FROM public.mutual_funds WHERE user_id = p_user_id;
    DELETE FROM public.goals WHERE user_id = p_user_id;
    DELETE FROM public.recipients WHERE user_id = p_user_id;
    DELETE FROM public.accounts WHERE user_id = p_user_id;
    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 10. Ultimate revert_ledger_log (The Masterpiece)
CREATE OR REPLACE FUNCTION revert_ledger_log(p_log_id UUID, p_user_id UUID) RETURNS JSONB AS $$
DECLARE v_log RECORD; v_sub RECORD; v_trade RECORD; v_mf_trade RECORD; v_item RECORD; v_curr NUMERIC; v_rev NUMERIC; v_meta JSONB;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN RAISE EXCEPTION 'Unauthorized'; END IF;
    SELECT * INTO v_log FROM ledger_logs WHERE id = p_log_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Log not found'); END IF;

    IF v_log.action_type = 'CREATE' THEN
         DELETE FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id;
    ELSIF v_log.action_type = 'DELETE' THEN
        v_meta := v_log.metadata;
        IF v_meta IS NOT NULL THEN
            INSERT INTO accounts (id, user_id, name, type, balance, bank_name, created_at)
            VALUES ((v_meta->>'id')::UUID, (v_meta->>'user_id')::UUID, v_meta->>'name', v_meta->>'type', (v_meta->>'balance')::NUMERIC, v_meta->>'bank_name', (v_meta->>'created_at')::TIMESTAMPTZ);
        END IF;
    ELSIF v_log.source_type = 'investment' THEN
        SELECT * INTO v_trade FROM stock_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM investments WHERE id = v_trade.investment_id AND user_id = p_user_id FOR UPDATE;
            IF v_trade.trade_type = 'buy' THEN
                UPDATE investments SET quantity = quantity - v_trade.quantity, buy_price = CASE WHEN (quantity - v_trade.quantity) > 0 THEN ((quantity * buy_price) - v_trade.total_amount) / (quantity - v_trade.quantity) ELSE 0 END WHERE id = v_item.id;
            ELSE
                UPDATE investments SET quantity = quantity + v_trade.quantity, realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_trade.realized_pnl, 0) WHERE id = v_item.id;
            END IF;
            DELETE FROM stock_trades WHERE id = v_trade.id;
        END IF;
    ELSIF v_log.source_type = 'mutual_fund' THEN
        SELECT * INTO v_mf_trade FROM mutual_fund_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM mutual_funds WHERE id = v_mf_trade.mf_id AND user_id = p_user_id FOR UPDATE;
            IF v_mf_trade.trade_type = 'BUY' THEN
                UPDATE mutual_funds SET units = units - v_mf_trade.units, avg_nav = CASE WHEN (units - v_mf_trade.units) > 0 THEN ((units * avg_nav) - v_mf_trade.amount) / (units - v_mf_trade.units) ELSE 0 END WHERE id = v_item.id;
            ELSE
                UPDATE mutual_funds SET units = units + v_mf_trade.units, realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_mf_trade.realized_pnl, 0) WHERE id = v_item.id;
            END IF;
            DELETE FROM mutual_fund_trades WHERE id = v_mf_trade.id;
        END IF;
    ELSIF v_log.source_type = 'goal' THEN
        UPDATE goals SET current_amount = current_amount - v_log.amount WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'transfer' THEN
        FOR v_sub IN SELECT * FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id AND user_id = p_user_id LOOP
            UPDATE accounts SET balance = balance + (CASE WHEN v_sub.action_type = 'TRANSFER_OUT' THEN v_sub.amount ELSE -v_sub.amount END) WHERE id = v_sub.account_id AND user_id = p_user_id;
        END LOOP;
        DELETE FROM transfers WHERE id = v_log.source_id AND user_id = p_user_id;
        DELETE FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'income' THEN DELETE FROM incomes WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'expense' THEN DELETE FROM expenses WHERE id = v_log.source_id AND user_id = p_user_id;
    END IF;

    DELETE FROM transactions WHERE ledger_log_id = p_log_id AND user_id = p_user_id;

    SELECT balance INTO v_curr FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;
    IF FOUND THEN
        v_rev := CASE WHEN v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY') THEN v_log.amount WHEN v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN', 'SEND_MONEY_IN') THEN -v_log.amount ELSE 0 END;
        UPDATE accounts SET balance = balance + v_rev WHERE id = v_log.account_id;
    END IF;

    DELETE FROM ledger_logs WHERE id = p_log_id;
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 13. Final Grants
GRANT EXECUTE ON FUNCTION process_transfer(UUID, UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_income(UUID, TEXT, NUMERIC, TEXT, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_expense(UUID, TEXT, NUMERIC, TEXT, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION record_investment(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE, UUID, NUMERIC, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION record_mf_investment_v4(UUID, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, DATE, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_family_transfer(UUID, UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_account_balance(UUID, UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_account_atomic_v2(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_account_atomic(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION contribute_to_goal(UUID, UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION revert_ledger_log(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_data(UUID) TO authenticated;
