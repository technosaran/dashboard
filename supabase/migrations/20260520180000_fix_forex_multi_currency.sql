-- Migration: Fix Forex Multi-Currency Transaction Deductions
-- Purpose: Ensure that deposit and withdrawal actions dynamically scale base currency updates (INR) when linked with foreign currency forex accounts (USD) using the default exchange rate 83.5.

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
