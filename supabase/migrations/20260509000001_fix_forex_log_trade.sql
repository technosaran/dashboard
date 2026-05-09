-- Fix forex_log_trade to prevent silent failure or unauthorized insertions
CREATE OR REPLACE FUNCTION forex_log_trade(
  p_user_id UUID,
  p_forex_account_id UUID,
  p_pair TEXT,
  p_trade_type TEXT,
  p_lot_size DECIMAL,
  p_pnl DECIMAL,
  p_trade_date DATE DEFAULT CURRENT_DATE,
  p_entry_price DECIMAL DEFAULT NULL,
  p_exit_price DECIMAL DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_forex_label TEXT;
BEGIN
  -- Validate Forex Account and ensure ownership
  SELECT account_label INTO v_forex_label
  FROM forex_accounts WHERE id = p_forex_account_id AND user_id = p_user_id FOR UPDATE;

  IF v_forex_label IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Forex account not found or access denied');
  END IF;

  -- Insert trade
  INSERT INTO forex_trades (user_id, forex_account_id, pair, trade_type, lot_size, entry_price, exit_price, pnl, trade_date, status, notes)
  VALUES (p_user_id, p_forex_account_id, p_pair, p_trade_type, p_lot_size, p_entry_price, p_exit_price, p_pnl, p_trade_date, 'Closed', p_notes);

  -- Update forex account balance and running P&L
  UPDATE forex_accounts
  SET balance = balance + p_pnl,
      total_pnl = total_pnl + p_pnl
  WHERE id = p_forex_account_id AND user_id = p_user_id;

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
