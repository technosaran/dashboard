-- Migration: Fix Forex Trade Logging and Balance Synchronization
-- Date: 2026-07-18
-- Purpose: Ensure that creating/updating forex trades propagates balance updates to standard bank accounts and records ledger logs + transactions.

-- 1. Drop existing function signatures to prevent overload conflicts
DROP FUNCTION IF EXISTS public.forex_log_trade(UUID, UUID, TEXT, TEXT, DECIMAL, DECIMAL, DATE, DECIMAL, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS public.forex_log_trade(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, DATE, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.update_forex_trade_atomic(UUID, UUID, UUID, TEXT, TEXT, DECIMAL, DECIMAL, DATE, DECIMAL, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS public.update_forex_trade_atomic(UUID, UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, DATE, NUMERIC, NUMERIC, TEXT);

-- 2. Redefine forex_log_trade to update accounts and record logs
CREATE OR REPLACE FUNCTION public.forex_log_trade(
  p_user_id UUID,
  p_forex_account_id UUID,
  p_pair TEXT,
  p_trade_type TEXT,
  p_lot_size NUMERIC,
  p_pnl NUMERIC,
  p_trade_date DATE DEFAULT CURRENT_DATE,
  p_entry_price NUMERIC DEFAULT NULL,
  p_exit_price NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_forex_label TEXT;
  v_old_bal NUMERIC;
  v_acc_name TEXT;
  v_trade_id UUID;
  v_log_id UUID;
BEGIN
  -- Validate Forex Account and ensure ownership
  SELECT account_label INTO v_forex_label
  FROM forex_accounts WHERE id = p_forex_account_id AND user_id = p_user_id FOR UPDATE;

  IF v_forex_label IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Forex account not found or access denied');
  END IF;

  v_trade_id := gen_random_uuid();
  v_log_id := gen_random_uuid();

  -- Insert trade record
  INSERT INTO forex_trades (id, user_id, forex_account_id, pair, trade_type, lot_size, entry_price, exit_price, pnl, trade_date, status, notes)
  VALUES (v_trade_id, p_user_id, p_forex_account_id, p_pair, p_trade_type, p_lot_size, p_entry_price, p_exit_price, p_pnl, p_trade_date, 'Closed', p_notes);

  -- Update forex account balance and running P&L
  UPDATE forex_accounts
  SET balance = balance + p_pnl,
      total_pnl = total_pnl + p_pnl
  WHERE id = p_forex_account_id AND user_id = p_user_id;

  -- Lock and update standard account balance
  SELECT balance, name INTO v_old_bal, v_acc_name 
  FROM accounts 
  WHERE id = p_forex_account_id AND user_id = p_user_id FOR UPDATE;

  IF FOUND THEN
    UPDATE accounts 
    SET balance = balance + p_pnl 
    WHERE id = p_forex_account_id AND user_id = p_user_id;

    -- Log to ledger
    INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES (
      v_log_id,
      p_user_id,
      p_forex_account_id,
      v_acc_name,
      CASE WHEN p_pnl >= 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
      ABS(p_pnl),
      v_old_bal,
      v_old_bal + p_pnl,
      'Forex Trade PnL (' || p_pair || '): ' || COALESCE(p_notes, 'Closed Trade'),
      v_trade_id,
      'forex_trade'
    );

    -- Log to standard transactions list
    INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
    VALUES (
      p_user_id,
      p_forex_account_id,
      'Forex Trade: ' || p_pair || ' (' || p_trade_type || ')',
      ABS(p_pnl),
      CASE WHEN p_pnl >= 0 THEN 'income' ELSE 'expense' END,
      'Investments',
      p_trade_date,
      v_trade_id,
      'forex_trade',
      v_log_id
    );
  END IF;

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Redefine update_forex_trade_atomic to safely update trade details and maintain audit trail
CREATE OR REPLACE FUNCTION public.update_forex_trade_atomic(
  p_user_id UUID,
  p_trade_id UUID,
  p_forex_account_id UUID,
  p_pair TEXT,
  p_trade_type TEXT,
  p_lot_size NUMERIC,
  p_pnl NUMERIC,
  p_trade_date DATE,
  p_entry_price NUMERIC,
  p_exit_price NUMERIC,
  p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_old_forex_account_id UUID;
  v_old_pnl NUMERIC;
  v_exists BOOLEAN := FALSE;
  v_old_std_bal_1 NUMERIC;
  v_acc_name_1 TEXT;
  v_old_std_bal_2 NUMERIC;
  v_acc_name_2 TEXT;
  v_log_id UUID;
BEGIN
  -- Validate user authority
  IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized'); 
  END IF;

  -- Get the old trade data
  SELECT forex_account_id, pnl, TRUE INTO v_old_forex_account_id, v_old_pnl, v_exists
  FROM forex_trades
  WHERE id = p_trade_id AND user_id = p_user_id FOR UPDATE;

  IF NOT COALESCE(v_exists, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forex trade not found');
  END IF;

  -- Update the trade record
  UPDATE forex_trades
  SET forex_account_id = p_forex_account_id,
      pair = p_pair,
      trade_type = p_trade_type,
      lot_size = p_lot_size,
      pnl = p_pnl,
      trade_date = p_trade_date,
      entry_price = p_entry_price,
      exit_price = p_exit_price,
      notes = p_notes,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = p_trade_id AND user_id = p_user_id;

  -- Update forex_accounts balances
  IF v_old_forex_account_id = p_forex_account_id THEN
    UPDATE forex_accounts
    SET balance = balance - v_old_pnl + p_pnl,
        total_pnl = total_pnl - v_old_pnl + p_pnl
    WHERE id = p_forex_account_id AND user_id = p_user_id;
  ELSE
    UPDATE forex_accounts
    SET balance = balance - v_old_pnl,
        total_pnl = total_pnl - v_old_pnl
    WHERE id = v_old_forex_account_id AND user_id = p_user_id;

    UPDATE forex_accounts
    SET balance = balance + p_pnl,
        total_pnl = total_pnl + p_pnl
    WHERE id = p_forex_account_id AND user_id = p_user_id;
  END IF;

  -- Update standard accounts balances, ledger logs, and transactions
  v_log_id := gen_random_uuid();
  IF v_old_forex_account_id = p_forex_account_id THEN
    -- Same standard account
    SELECT balance, name INTO v_old_std_bal_1, v_acc_name_1 
    FROM accounts 
    WHERE id = p_forex_account_id AND user_id = p_user_id FOR UPDATE;

    IF FOUND THEN
      UPDATE accounts 
      SET balance = balance - v_old_pnl + p_pnl 
      WHERE id = p_forex_account_id AND user_id = p_user_id;

      -- Log the adjustment to ledger
      INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
      VALUES (
        v_log_id,
        p_user_id,
        p_forex_account_id,
        v_acc_name_1,
        CASE WHEN (p_pnl - v_old_pnl) >= 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
        ABS(p_pnl - v_old_pnl),
        v_old_std_bal_1,
        v_old_std_bal_1 - v_old_pnl + p_pnl,
        'Forex Trade PnL Adjusted (' || p_pair || '): ' || COALESCE(p_notes, ''),
        p_trade_id,
        'forex_trade'
      );

      -- Update transaction log
      DELETE FROM transactions WHERE source_id = p_trade_id AND source_type = 'forex_trade' AND user_id = p_user_id;
      
      INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
      VALUES (
        p_user_id,
        p_forex_account_id,
        'Forex Trade: ' || p_pair || ' (' || p_trade_type || ')',
        ABS(p_pnl),
        CASE WHEN p_pnl >= 0 THEN 'income' ELSE 'expense' END,
        'Investments',
        p_trade_date,
        p_trade_id,
        'forex_trade',
        v_log_id
      );
    END IF;
  ELSE
    -- Different standard accounts: subtract old pnl from old, add new pnl to new
    SELECT balance, name INTO v_old_std_bal_1, v_acc_name_1 
    FROM accounts 
    WHERE id = v_old_forex_account_id AND user_id = p_user_id FOR UPDATE;

    IF FOUND THEN
      UPDATE accounts 
      SET balance = balance - v_old_pnl 
      WHERE id = v_old_forex_account_id AND user_id = p_user_id;

      INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
      VALUES (
        p_user_id,
        v_old_forex_account_id,
        v_acc_name_1,
        CASE WHEN v_old_pnl >= 0 THEN 'ADJUST_DOWN' ELSE 'ADJUST_UP' END,
        ABS(v_old_pnl),
        v_old_std_bal_1,
        v_old_std_bal_1 - v_old_pnl,
        'Forex Trade Reverted from Account (' || p_pair || ')',
        p_trade_id,
        'forex_trade'
      );
    END IF;

    SELECT balance, name INTO v_old_std_bal_2, v_acc_name_2 
    FROM accounts 
    WHERE id = p_forex_account_id AND user_id = p_user_id FOR UPDATE;

    IF FOUND THEN
      UPDATE accounts 
      SET balance = balance + p_pnl 
      WHERE id = p_forex_account_id AND user_id = p_user_id;

      INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
      VALUES (
        v_log_id,
        p_user_id,
        p_forex_account_id,
        v_acc_name_2,
        CASE WHEN p_pnl >= 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
        ABS(p_pnl),
        v_old_std_bal_2,
        v_old_std_bal_2 + p_pnl,
        'Forex Trade Moved to Account (' || p_pair || '): ' || COALESCE(p_notes, ''),
        p_trade_id,
        'forex_trade'
      );

      DELETE FROM transactions WHERE source_id = p_trade_id AND source_type = 'forex_trade' AND user_id = p_user_id;

      INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
      VALUES (
        p_user_id,
        p_forex_account_id,
        'Forex Trade: ' || p_pair || ' (' || p_trade_type || ')',
        ABS(p_pnl),
        CASE WHEN p_pnl >= 0 THEN 'income' ELSE 'expense' END,
        'Investments',
        p_trade_date,
        p_trade_id,
        'forex_trade',
        v_log_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION public.forex_log_trade(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, DATE, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_forex_trade_atomic(UUID, UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC, DATE, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
