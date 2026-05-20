
-- Migration: Fix Reset Data and Revert Logic for All Modules
-- Purpose: Ensure every section can be reset and every ledger log can be reverted.

-- 1. Update reset_user_data to include ALL tables
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

-- 2. Enhanced adjust_account_balance to support source tracking
CREATE OR REPLACE FUNCTION adjust_account_balance(
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
    
    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES (p_user_id, p_account_id, v_acc_name, CASE WHEN p_amount >= 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END, ABS(p_amount), v_old_bal, v_old_bal + p_amount, COALESCE(p_note, 'Manual adjustment'), p_source_id, p_source_type)
    RETURNING id INTO v_log_id;

    INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, ledger_log_id)
    VALUES (p_user_id, p_account_id, COALESCE(p_note, 'Balance adjustment'), ABS(p_amount), CASE WHEN p_amount >= 0 THEN 'income' ELSE 'expense' END, 'Adjustments', CURRENT_DATE, v_log_id)
    RETURNING id INTO v_txn_id;

    -- If no source_id was provided, link to the transaction we just created
    IF p_source_id IS NULL THEN
        UPDATE ledger_logs SET source_id = v_txn_id WHERE id = v_log_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'new_balance', v_old_bal + p_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Update revert_ledger_log to handle more source types
CREATE OR REPLACE FUNCTION revert_ledger_log(p_log_id UUID, p_user_id UUID) RETURNS JSONB AS $$
DECLARE 
    v_log RECORD; 
    v_sub RECORD; 
    v_trade RECORD; 
    v_mf_trade RECORD; 
    v_bond_trade RECORD;
    v_forex_txn RECORD;
    v_item RECORD; 
    v_curr NUMERIC; 
    v_rev NUMERIC; 
    v_meta JSONB;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;

    SELECT * INTO v_log FROM ledger_logs WHERE id = p_log_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Log not found'); END IF;

    -- Module-specific logic based on source_type
    IF v_log.action_type = 'CREATE' THEN
         DELETE FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id;
    ELSIF v_log.action_type = 'DELETE' THEN
        v_meta := v_log.metadata;
        IF v_meta IS NOT NULL THEN
            INSERT INTO accounts (id, user_id, name, type, balance, color, institution, account_number, created_at)
            VALUES (
                (v_meta->>'id')::UUID, 
                (v_meta->>'user_id')::UUID, 
                v_meta->>'name', 
                v_meta->>'type', 
                (v_meta->>'balance')::NUMERIC, 
                v_meta->>'color', 
                v_meta->>'institution', 
                v_meta->>'account_number', 
                (v_meta->>'created_at')::TIMESTAMPTZ
            );
        END IF;
    ELSIF v_log.source_type = 'investment' THEN
        SELECT * INTO v_trade FROM stock_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM investments WHERE id = v_trade.investment_id AND user_id = p_user_id FOR UPDATE;
            IF v_trade.trade_type = 'buy' THEN
                UPDATE investments SET 
                    quantity = quantity - v_trade.quantity, 
                    buy_price = CASE WHEN (quantity - v_trade.quantity) > 0 THEN ((quantity * buy_price) - v_trade.total_amount) / (quantity - v_trade.quantity) ELSE 0 END,
                    updated_at = NOW()
                WHERE id = v_item.id;
            ELSE
                UPDATE investments SET 
                    quantity = quantity + v_trade.quantity, 
                    realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_trade.realized_pnl, 0),
                    updated_at = NOW()
                WHERE id = v_item.id;
            END IF;
            DELETE FROM stock_trades WHERE id = v_trade.id;
        END IF;
    ELSIF v_log.source_type = 'mutual_fund' THEN
        SELECT * INTO v_mf_trade FROM mutual_fund_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM mutual_funds WHERE id = v_mf_trade.mf_id AND user_id = p_user_id FOR UPDATE;
            IF v_mf_trade.trade_type = 'BUY' THEN
                UPDATE mutual_funds SET 
                    units = units - v_mf_trade.units, 
                    avg_nav = CASE WHEN (units - v_mf_trade.units) > 0 THEN ((units * avg_nav) - v_mf_trade.amount) / (units - v_mf_trade.units) ELSE 0 END,
                    updated_at = NOW()
                WHERE id = v_item.id;
            ELSE
                UPDATE mutual_funds SET 
                    units = units + v_mf_trade.units, 
                    realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_mf_trade.realized_pnl, 0),
                    updated_at = NOW()
                WHERE id = v_item.id;
            END IF;
            DELETE FROM mutual_fund_trades WHERE id = v_mf_trade.id;
        END IF;
    ELSIF v_log.source_type = 'bond' THEN
        SELECT * INTO v_bond_trade FROM bond_transactions WHERE bond_id = v_log.source_id AND user_id = p_user_id AND (amount = v_log.amount OR interest_amount = v_log.amount) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM bonds WHERE id = v_bond_trade.bond_id AND user_id = p_user_id FOR UPDATE;
            IF v_bond_trade.transaction_type = 'BUY' THEN
                UPDATE bonds SET 
                    quantity = quantity - v_bond_trade.quantity,
                    total_invested = total_invested - v_bond_trade.amount,
                    current_value = current_value - (v_item.current_price * v_bond_trade.quantity),
                    updated_at = NOW()
                WHERE id = v_item.id;
                IF (v_item.quantity - v_bond_trade.quantity) <= 0 THEN
                    DELETE FROM bonds WHERE id = v_item.id;
                END IF;
            ELSIF v_bond_trade.transaction_type = 'INTEREST' THEN
                UPDATE bonds SET 
                    total_interest_earned = COALESCE(total_interest_earned, 0) - v_bond_trade.interest_amount,
                    updated_at = NOW()
                WHERE id = v_item.id;
            END IF;
            DELETE FROM bond_transactions WHERE id = v_bond_trade.id;
        END IF;
    ELSIF v_log.source_type = 'forex' THEN
        SELECT * INTO v_forex_txn FROM forex_transactions WHERE id = v_log.source_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            IF v_forex_txn.transaction_type = 'DEPOSIT' THEN
                UPDATE forex_accounts SET 
                    balance = balance - v_forex_txn.amount,
                    total_deposited = total_deposited - v_forex_txn.amount,
                    updated_at = NOW()
                WHERE id = v_forex_txn.forex_account_id;
            ELSE
                UPDATE forex_accounts SET 
                    balance = balance + v_forex_txn.amount,
                    total_withdrawn = total_withdrawn - v_forex_txn.amount,
                    updated_at = NOW()
                WHERE id = v_forex_txn.forex_account_id;
            END IF;
            DELETE FROM forex_transactions WHERE id = v_forex_txn.id;
        END IF;
    ELSIF v_log.source_type = 'alternative_asset' THEN
        DELETE FROM alternative_assets WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'liability' THEN
        DELETE FROM liabilities WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'goal' THEN
        UPDATE goals SET current_amount = current_amount - v_log.amount, updated_at = NOW() WHERE id = v_log.source_id AND user_id = p_user_id;
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

    -- Common account balance reversal
    SELECT balance INTO v_curr FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;
    IF FOUND THEN
        v_rev := CASE 
            WHEN v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY') THEN v_log.amount 
            WHEN v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN', 'SEND_MONEY_IN') THEN -v_log.amount 
            ELSE 0 
        END;
        IF v_rev != 0 THEN
            UPDATE accounts SET balance = balance + v_rev WHERE id = v_log.account_id;
        END IF;
    END IF;

    DELETE FROM ledger_logs WHERE id = p_log_id;
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Fix bond tracking (populating source_id/source_type)
CREATE OR REPLACE FUNCTION record_bond_purchase(
    p_user_id UUID, p_bond_name TEXT, p_isin TEXT, p_issuer TEXT, p_bond_type TEXT, p_face_value DECIMAL, p_quantity INTEGER, p_purchase_price DECIMAL, p_current_price DECIMAL, p_coupon_rate DECIMAL, p_ytm DECIMAL DEFAULT NULL, p_purchase_date DATE DEFAULT CURRENT_DATE, p_maturity_date DATE DEFAULT CURRENT_DATE, p_next_interest_date DATE DEFAULT NULL, p_interest_frequency TEXT DEFAULT 'Semi-Annual', p_credit_rating TEXT DEFAULT NULL, p_platform TEXT DEFAULT 'Wint', p_demat_account TEXT DEFAULT NULL, p_account_id UUID DEFAULT NULL, p_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE v_total DECIMAL; v_bond_id UUID; v_old_bal DECIMAL; v_acc_name TEXT;
BEGIN
    v_total := p_purchase_price * p_quantity;
    INSERT INTO public.bonds (user_id, bond_name, isin, issuer, bond_type, face_value, quantity, purchase_price, current_price, total_invested, current_value, coupon_rate, ytm, purchase_date, maturity_date, next_interest_date, interest_frequency, credit_rating, platform, demat_account, notes, status)
    VALUES (p_user_id, p_bond_name, p_isin, p_issuer, p_bond_type, p_face_value, p_quantity, p_purchase_price, p_current_price, v_total, p_current_price * p_quantity, p_coupon_rate, p_ytm, p_purchase_date, p_maturity_date, p_next_interest_date, p_interest_frequency, p_credit_rating, p_platform, p_demat_account, p_notes, 'Active')
    RETURNING id INTO v_bond_id;

    INSERT INTO public.bond_transactions (user_id, bond_id, transaction_type, transaction_date, quantity, price_per_bond, amount, account_id)
    VALUES (p_user_id, v_bond_id, 'BUY', p_purchase_date, p_quantity, p_purchase_price, v_total, p_account_id);

    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        IF v_old_bal < v_total THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
        UPDATE public.accounts SET balance = balance - v_total WHERE id = p_account_id;
        INSERT INTO public.ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (p_user_id, p_account_id, v_acc_name, 'ADJUST_DOWN', v_total, v_old_bal, v_old_bal - v_total, 'Purchased ' || p_quantity || ' units of ' || p_bond_name, v_bond_id, 'bond');
    END IF;
    RETURN json_build_object('success', true, 'bond_id', v_bond_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION record_bond_interest(
    p_user_id UUID, p_bond_id UUID, p_amount DECIMAL, p_payment_date DATE, p_period_start DATE, p_period_end DATE, p_account_id UUID DEFAULT NULL
) RETURNS JSON AS $$
DECLARE v_old_bal DECIMAL; v_acc_name TEXT;
BEGIN
    INSERT INTO public.bond_transactions (user_id, bond_id, transaction_type, transaction_date, amount, interest_amount, interest_period_start, interest_period_end, account_id)
    VALUES (p_user_id, p_bond_id, 'INTEREST', p_payment_date, p_amount, p_amount, p_period_start, p_period_end, p_account_id);

    UPDATE public.bonds SET total_interest_earned = COALESCE(total_interest_earned, 0) + p_amount, accrued_interest = 0 WHERE id = p_bond_id AND user_id = p_user_id;

    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        UPDATE public.accounts SET balance = balance + p_amount WHERE id = p_account_id;
        INSERT INTO public.ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (p_user_id, p_account_id, v_acc_name, 'ADJUST_UP', p_amount, v_old_bal, v_old_bal + p_amount, 'Bond interest received', p_bond_id, 'bond');
    END IF;
    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Fix Forex tracking
CREATE OR REPLACE FUNCTION forex_deposit(
  p_user_id UUID, p_forex_account_id UUID, p_bank_account_id UUID DEFAULT NULL, p_amount DECIMAL DEFAULT 0, p_date DATE DEFAULT CURRENT_DATE, p_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE 
  v_bank_bal DECIMAL; 
  v_bank_name TEXT; 
  v_forex_label TEXT; 
  v_txn_id UUID; 
  v_bank_curr TEXT; 
  v_deduct_amount DECIMAL;
BEGIN
  IF p_amount <= 0 THEN RETURN json_build_object('success', false, 'error', 'Amount must be positive'); END IF;
  SELECT account_label INTO v_forex_label FROM forex_accounts WHERE id = p_forex_account_id AND user_id = p_user_id;
  IF v_forex_label IS NULL THEN RETURN json_build_object('success', false, 'error', 'Forex account not found'); END IF;

  INSERT INTO forex_transactions (user_id, forex_account_id, bank_account_id, transaction_type, amount, notes, transaction_date)
  VALUES (p_user_id, p_forex_account_id, p_bank_account_id, 'DEPOSIT', p_amount, p_notes, p_date)
  RETURNING id INTO v_txn_id;

  IF p_bank_account_id IS NOT NULL THEN
    SELECT balance, name, currency INTO v_bank_bal, v_bank_name, v_bank_curr FROM accounts WHERE id = p_bank_account_id AND user_id = p_user_id FOR UPDATE;
    IF v_bank_bal IS NULL THEN RETURN json_build_object('success', false, 'error', 'Bank account not found'); END IF;
    
    IF v_bank_curr = 'INR' THEN
      v_deduct_amount := p_amount * 83.5;
    ELSE
      v_deduct_amount := p_amount;
    END IF;

    IF v_bank_bal < v_deduct_amount THEN 
      RETURN json_build_object('success', false, 'error', 'Insufficient bank balance');
    END IF;

    UPDATE accounts SET balance = balance - v_deduct_amount WHERE id = p_bank_account_id;
    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES (p_user_id, p_bank_account_id, v_bank_name, 'ADJUST_DOWN', v_deduct_amount, v_bank_bal, v_bank_bal - v_deduct_amount, 'Forex deposit to ' || v_forex_label, v_txn_id, 'forex');
  END IF;

  UPDATE forex_accounts SET balance = balance + p_amount, total_deposited = total_deposited + p_amount WHERE id = p_forex_account_id;
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION forex_withdraw(
  p_user_id UUID, p_forex_account_id UUID, p_bank_account_id UUID DEFAULT NULL, p_amount DECIMAL DEFAULT 0, p_date DATE DEFAULT CURRENT_DATE, p_notes TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE 
  v_forex_bal DECIMAL; 
  v_forex_label TEXT; 
  v_bank_bal DECIMAL; 
  v_bank_name TEXT; 
  v_txn_id UUID; 
  v_bank_curr TEXT; 
  v_credit_amount DECIMAL;
BEGIN
  IF p_amount <= 0 THEN RETURN json_build_object('success', false, 'error', 'Amount must be positive'); END IF;
  SELECT balance, account_label INTO v_forex_bal, v_forex_label FROM forex_accounts WHERE id = p_forex_account_id AND user_id = p_user_id FOR UPDATE;
  IF v_forex_label IS NULL THEN RETURN json_build_object('success', false, 'error', 'Forex account not found'); END IF;
  IF v_forex_bal < p_amount THEN RETURN json_build_object('success', false, 'error', 'Insufficient forex balance'); END IF;

  INSERT INTO forex_transactions (user_id, forex_account_id, bank_account_id, transaction_type, amount, notes, transaction_date)
  VALUES (p_user_id, p_forex_account_id, p_bank_account_id, 'WITHDRAW', p_amount, p_notes, p_date)
  RETURNING id INTO v_txn_id;

  UPDATE forex_accounts SET balance = balance - p_amount, total_withdrawn = total_withdrawn + p_amount WHERE id = p_forex_account_id;

  IF p_bank_account_id IS NOT NULL THEN
    SELECT balance, name, currency INTO v_bank_bal, v_bank_name, v_bank_curr FROM accounts WHERE id = p_bank_account_id AND user_id = p_user_id FOR UPDATE;
    IF v_bank_bal IS NULL THEN RETURN json_build_object('success', false, 'error', 'Bank account not found'); END IF;

    IF v_bank_curr = 'INR' THEN
      v_credit_amount := p_amount * 83.5;
    ELSE
      v_credit_amount := p_amount;
    END IF;

    UPDATE accounts SET balance = balance + v_credit_amount WHERE id = p_bank_account_id;
    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES (p_user_id, p_bank_account_id, v_bank_name, 'ADJUST_UP', v_credit_amount, v_bank_bal, v_bank_bal + v_credit_amount, 'Forex withdrawal from ' || v_forex_label, v_txn_id, 'forex');
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
