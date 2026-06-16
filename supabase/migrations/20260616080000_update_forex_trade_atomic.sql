-- Migration: 20260616080000_update_forex_trade_atomic.sql
-- Purpose: Safely update a forex trade and synchronously adjust the balance and total PnL of affected forex accounts.

CREATE OR REPLACE FUNCTION update_forex_trade_atomic(
  p_user_id UUID,
  p_trade_id UUID,
  p_forex_account_id UUID,
  p_pair TEXT,
  p_trade_type TEXT,
  p_lot_size DECIMAL,
  p_pnl DECIMAL,
  p_trade_date DATE,
  p_entry_price DECIMAL,
  p_exit_price DECIMAL,
  p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_old_forex_account_id UUID;
  v_old_pnl DECIMAL;
  v_exists BOOLEAN := FALSE;
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

  -- Update account balances
  IF v_old_forex_account_id = p_forex_account_id THEN
    -- Same account: adjust balance by (new_pnl - old_pnl)
    UPDATE forex_accounts
    SET balance = balance - v_old_pnl + p_pnl,
        total_pnl = total_pnl - v_old_pnl + p_pnl
    WHERE id = p_forex_account_id AND user_id = p_user_id;
  ELSE
    -- Different accounts: subtract old pnl from old account, add new pnl to new account
    UPDATE forex_accounts
    SET balance = balance - v_old_pnl,
        total_pnl = total_pnl - v_old_pnl
    WHERE id = v_old_forex_account_id AND user_id = p_user_id;

    UPDATE forex_accounts
    SET balance = balance + p_pnl,
        total_pnl = total_pnl + p_pnl
    WHERE id = p_forex_account_id AND user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
