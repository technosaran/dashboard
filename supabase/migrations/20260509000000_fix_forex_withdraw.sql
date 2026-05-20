-- Fix forex_withdraw to prevent silent money vanishing when bank account is invalid
CREATE OR REPLACE FUNCTION forex_withdraw(
  p_user_id UUID,
  p_forex_account_id UUID,
  p_bank_account_id UUID DEFAULT NULL,
  p_amount DECIMAL DEFAULT 0,
  p_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_forex_balance DECIMAL;
  v_forex_label TEXT;
  v_bank_balance DECIMAL;
  v_bank_name TEXT;
  v_bank_curr TEXT;
  v_credit_amount DECIMAL;
BEGIN
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- 1. Validate Forex Account
  SELECT balance, account_label INTO v_forex_balance, v_forex_label
  FROM forex_accounts WHERE id = p_forex_account_id AND user_id = p_user_id FOR UPDATE;

  IF v_forex_label IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Forex account not found');
  END IF;
  IF v_forex_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient forex balance');
  END IF;

  -- 2. Validate Bank Account (if specified) BEFORE any mutations
  IF p_bank_account_id IS NOT NULL THEN
    SELECT balance, name, currency INTO v_bank_balance, v_bank_name, v_bank_curr
    FROM accounts WHERE id = p_bank_account_id AND user_id = p_user_id FOR UPDATE;

    IF v_bank_balance IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Bank account not found or access denied');
    END IF;
  END IF;

  -- 3. Perform Mutations
  -- Deduct from forex
  UPDATE forex_accounts
  SET balance = balance - p_amount,
      total_withdrawn = total_withdrawn + p_amount
  WHERE id = p_forex_account_id AND user_id = p_user_id;

  -- Credit bank account if specified
  IF p_bank_account_id IS NOT NULL THEN
    IF v_bank_curr = 'INR' THEN
      v_credit_amount := p_amount * 83.5;
    ELSE
      v_credit_amount := p_amount;
    END IF;

    UPDATE accounts SET balance = balance + v_credit_amount WHERE id = p_bank_account_id AND user_id = p_user_id;

    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
    VALUES (p_user_id, p_bank_account_id, v_bank_name, 'ADJUST_UP', v_credit_amount, v_bank_balance, v_bank_balance + v_credit_amount,
            'Forex withdrawal from ' || v_forex_label);
  END IF;

  -- Record transaction
  INSERT INTO forex_transactions (user_id, forex_account_id, bank_account_id, transaction_type, amount, notes, transaction_date)
  VALUES (p_user_id, p_forex_account_id, p_bank_account_id, 'WITHDRAW', p_amount, p_notes, p_date);

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
