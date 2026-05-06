-- Forex trading module: accounts + trades + atomic operations

-- Forex broker accounts (e.g. Exness, OctaFX, etc.)
CREATE TABLE IF NOT EXISTS forex_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,           -- e.g. Exness, OctaFX, IC Markets
  account_label TEXT NOT NULL,         -- User-friendly label
  account_number TEXT,                 -- Broker account number
  balance DECIMAL(15,2) NOT NULL DEFAULT 0,  -- Current balance in the forex account
  total_deposited DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_withdrawn DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_pnl DECIMAL(15,2) NOT NULL DEFAULT 0,  -- Running P&L from trades
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual forex trades log
CREATE TABLE IF NOT EXISTS forex_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  forex_account_id UUID NOT NULL REFERENCES forex_accounts(id) ON DELETE CASCADE,
  pair TEXT NOT NULL,                  -- e.g. EUR/USD, GBP/JPY
  trade_type TEXT NOT NULL CHECK (trade_type IN ('BUY', 'SELL')),
  lot_size DECIMAL(10,4) NOT NULL,    -- 0.01 = micro, 0.1 = mini, 1.0 = standard
  entry_price DECIMAL(15,5),
  exit_price DECIMAL(15,5),
  pnl DECIMAL(15,2) NOT NULL DEFAULT 0,
  trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  close_date DATE,
  status TEXT DEFAULT 'Closed' CHECK (status IN ('Open', 'Closed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Forex fund movements (deposits / withdrawals linked to bank accounts)
CREATE TABLE IF NOT EXISTS forex_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  forex_account_id UUID NOT NULL REFERENCES forex_accounts(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES accounts(id),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAW')),
  amount DECIMAL(15,2) NOT NULL,
  notes TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_forex_accounts_user ON forex_accounts(user_id);
CREATE INDEX idx_forex_trades_user ON forex_trades(user_id);
CREATE INDEX idx_forex_trades_account ON forex_trades(forex_account_id);
CREATE INDEX idx_forex_transactions_user ON forex_transactions(user_id);
CREATE INDEX idx_forex_transactions_account ON forex_transactions(forex_account_id);

-- RLS
ALTER TABLE forex_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forex_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE forex_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own forex_accounts" ON forex_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own forex_accounts" ON forex_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own forex_accounts" ON forex_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own forex_accounts" ON forex_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users view own forex_trades" ON forex_trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own forex_trades" ON forex_trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own forex_trades" ON forex_trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own forex_trades" ON forex_trades FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users view own forex_transactions" ON forex_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own forex_transactions" ON forex_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE forex_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE forex_trades;
ALTER PUBLICATION supabase_realtime ADD TABLE forex_transactions;

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_forex_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER forex_accounts_updated_at
  BEFORE UPDATE ON forex_accounts
  FOR EACH ROW EXECUTE FUNCTION update_forex_accounts_updated_at();

-- Atomic deposit: moves money from bank account into forex account
CREATE OR REPLACE FUNCTION forex_deposit(
  p_user_id UUID,
  p_forex_account_id UUID,
  p_bank_account_id UUID DEFAULT NULL,
  p_amount DECIMAL DEFAULT 0,
  p_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_bank_balance DECIMAL;
  v_bank_name TEXT;
  v_forex_label TEXT;
BEGIN
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT account_label INTO v_forex_label FROM forex_accounts WHERE id = p_forex_account_id AND user_id = p_user_id;
  IF v_forex_label IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Forex account not found');
  END IF;

  -- Deduct from bank account if specified
  IF p_bank_account_id IS NOT NULL THEN
    SELECT balance, name INTO v_bank_balance, v_bank_name
    FROM accounts WHERE id = p_bank_account_id AND user_id = p_user_id FOR UPDATE;

    IF v_bank_balance IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Bank account not found');
    END IF;
    IF v_bank_balance < p_amount THEN
      RETURN json_build_object('success', false, 'error', 'Insufficient bank balance');
    END IF;

    UPDATE accounts SET balance = balance - p_amount WHERE id = p_bank_account_id AND user_id = p_user_id;

    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
    VALUES (p_user_id, p_bank_account_id, v_bank_name, 'ADJUST_DOWN', p_amount, v_bank_balance, v_bank_balance - p_amount,
            'Forex deposit to ' || v_forex_label);
  END IF;

  -- Credit forex account
  UPDATE forex_accounts
  SET balance = balance + p_amount,
      total_deposited = total_deposited + p_amount
  WHERE id = p_forex_account_id AND user_id = p_user_id;

  -- Record transaction
  INSERT INTO forex_transactions (user_id, forex_account_id, bank_account_id, transaction_type, amount, notes, transaction_date)
  VALUES (p_user_id, p_forex_account_id, p_bank_account_id, 'DEPOSIT', p_amount, p_notes, p_date);

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic withdrawal: moves money from forex account to bank account
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
BEGIN
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT balance, account_label INTO v_forex_balance, v_forex_label
  FROM forex_accounts WHERE id = p_forex_account_id AND user_id = p_user_id FOR UPDATE;

  IF v_forex_label IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Forex account not found');
  END IF;
  IF v_forex_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient forex balance');
  END IF;

  -- Deduct from forex
  UPDATE forex_accounts
  SET balance = balance - p_amount,
      total_withdrawn = total_withdrawn + p_amount
  WHERE id = p_forex_account_id AND user_id = p_user_id;

  -- Credit bank account if specified
  IF p_bank_account_id IS NOT NULL THEN
    SELECT balance, name INTO v_bank_balance, v_bank_name
    FROM accounts WHERE id = p_bank_account_id AND user_id = p_user_id FOR UPDATE;

    IF v_bank_balance IS NOT NULL THEN
      UPDATE accounts SET balance = balance + p_amount WHERE id = p_bank_account_id AND user_id = p_user_id;

      INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
      VALUES (p_user_id, p_bank_account_id, v_bank_name, 'ADJUST_UP', p_amount, v_bank_balance, v_bank_balance + p_amount,
              'Forex withdrawal from ' || v_forex_label);
    END IF;
  END IF;

  -- Record transaction
  INSERT INTO forex_transactions (user_id, forex_account_id, bank_account_id, transaction_type, amount, notes, transaction_date)
  VALUES (p_user_id, p_forex_account_id, p_bank_account_id, 'WITHDRAW', p_amount, p_notes, p_date);

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic trade logging: records a trade and updates forex account P&L + balance
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
BEGIN
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

-- Update get_finance_overview to include forex data
CREATE OR REPLACE FUNCTION get_finance_overview()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_result JSON;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT json_build_object(
        'accounts', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.accounts WHERE user_id = v_user_id ORDER BY name ASC) t),
        'transactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.transactions WHERE user_id = v_user_id ORDER BY date DESC LIMIT 1000) t),
        'ledgerLogs', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.ledger_logs WHERE user_id = v_user_id ORDER BY created_at DESC LIMIT 50) t),
        'investments', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.investments WHERE user_id = v_user_id) t),
        'mutualFunds', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.mutual_funds WHERE user_id = v_user_id) t),
        'goals', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.goals WHERE user_id = v_user_id ORDER BY created_at DESC) t),
        'recipients', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.recipients WHERE user_id = v_user_id ORDER BY name) t),
        'incomes', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.incomes WHERE user_id = v_user_id ORDER BY date DESC LIMIT 500) t),
        'expenses', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.expenses WHERE user_id = v_user_id ORDER BY date DESC LIMIT 500) t),
        'stockTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.stock_trades WHERE user_id = v_user_id ORDER BY trade_date DESC LIMIT 50) t),
        'mutualFundTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.mutual_fund_trades WHERE user_id = v_user_id ORDER BY date DESC LIMIT 50) t),
        'bonds', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.bonds WHERE user_id = v_user_id ORDER BY maturity_date ASC) t),
        'bondTransactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.bond_transactions WHERE user_id = v_user_id ORDER BY transaction_date DESC LIMIT 50) t),
        'forexAccounts', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.forex_accounts WHERE user_id = v_user_id ORDER BY created_at DESC) t),
        'forexTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.forex_trades WHERE user_id = v_user_id ORDER BY trade_date DESC LIMIT 100) t),
        'forexTransactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.forex_transactions WHERE user_id = v_user_id ORDER BY transaction_date DESC LIMIT 50) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
