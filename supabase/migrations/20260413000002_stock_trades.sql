
-- Migration: Add Stock Trades History
-- Purpose: Log every individual buy/sell transaction for historical reporting and audit.

CREATE TABLE IF NOT EXISTS public.stock_trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    investment_id UUID REFERENCES public.investments(id) ON DELETE SET NULL,
    symbol TEXT NOT NULL,
    trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
    quantity NUMERIC(18, 6) NOT NULL,
    price NUMERIC(14, 2) NOT NULL,
    charges NUMERIC(14, 2) DEFAULT 0,
    total_amount NUMERIC(14, 2) NOT NULL, -- turnover +/- charges
    trade_date DATE DEFAULT CURRENT_DATE,
    exchange TEXT DEFAULT 'NSE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.stock_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own stock trades"
    ON public.stock_trades FOR ALL
    USING (auth.uid() = user_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE stock_trades;

-- Indexing
CREATE INDEX IF NOT EXISTS idx_stock_trades_user_id ON stock_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_trades_symbol ON stock_trades(symbol);
