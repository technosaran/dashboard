-- Migration: Investments / Portfolio Tracker
-- Purpose: Track stocks, mutual funds, gold, crypto holdings

CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('stock', 'mutual_fund', 'gold', 'crypto', 'bond', 'fixed_deposit', 'other')),
  symbol TEXT,
  quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
  buy_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  current_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  notes TEXT,
  bought_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own investments"
  ON investments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_type ON investments(user_id, type);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE investments;
