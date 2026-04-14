
-- Mutual Funds System Migration (Zerodha Coin Style)
CREATE TABLE IF NOT EXISTS public.mutual_funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fund_name TEXT NOT NULL,
    fund_symbol TEXT, -- ISIN or Scheme Code
    units NUMERIC NOT NULL DEFAULT 0,
    avg_nav NUMERIC NOT NULL DEFAULT 0,
    current_nav NUMERIC NOT NULL DEFAULT 0,
    investment_type TEXT DEFAULT 'SIP', -- SIP or LUMPSUM
    category TEXT DEFAULT 'Equity', -- Equity, Debt, Hybrid, etc.
    amc_name TEXT, -- Asset Management Company
    last_nav_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mutual_funds ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own mutual funds" 
    ON public.mutual_funds 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_mutual_funds_updated_at
    BEFORE UPDATE ON public.mutual_funds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Mutual fund transactions log (for history)
CREATE TABLE IF NOT EXISTS public.mutual_fund_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mf_id UUID REFERENCES public.mutual_funds(id) ON DELETE CASCADE,
    fund_name TEXT NOT NULL,
    trade_type TEXT NOT NULL, -- BUY, SELL
    units NUMERIC NOT NULL,
    nav NUMERIC NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.mutual_fund_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mf trades" 
    ON public.mutual_fund_trades 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Atomic RPC to log MF investment
CREATE OR REPLACE FUNCTION record_mf_investment(
    p_user_id UUID,
    p_fund_name TEXT,
    p_fund_symbol TEXT,
    p_units NUMERIC,
    p_nav NUMERIC,
    p_investment_type TEXT,
    p_category TEXT,
    p_amc_name TEXT,
    p_date DATE,
    p_account_id UUID
) RETURNS JSON AS $$
DECLARE
    v_mf_id UUID;
    v_total_amount NUMERIC;
    v_account_curr_balance NUMERIC;
BEGIN
    v_total_amount := p_units * p_nav;

    -- 1. Check account balance
    SELECT balance INTO v_account_curr_balance FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF v_account_curr_balance < v_total_amount THEN
        RETURN json_build_object('error', 'Insufficient funds in selected account');
    END IF;

    -- 2. Update/Create Mutual Fund Holding
    INSERT INTO public.mutual_funds (user_id, fund_name, fund_symbol, units, avg_nav, current_nav, investment_type, category, amc_name)
    VALUES (p_user_id, p_fund_name, p_fund_symbol, p_units, p_nav, p_nav, p_investment_type, p_category, p_amc_name)
    ON CONFLICT (id) DO UPDATE SET -- This is a simplification, in reality we handle ISIN matching
        units = public.mutual_funds.units + p_units,
        avg_nav = (public.mutual_funds.units * public.mutual_funds.avg_nav + v_total_amount) / (public.mutual_funds.units + p_units)
    RETURNING id INTO v_mf_id;

    -- 3. Log trade
    INSERT INTO public.mutual_fund_trades (user_id, mf_id, fund_name, trade_type, units, nav, amount, date)
    VALUES (p_user_id, v_mf_id, p_fund_name, 'BUY', p_units, p_nav, v_total_amount, p_date);

    -- 4. Deduct from account
    UPDATE public.accounts SET balance = balance - v_total_amount WHERE id = p_account_id;

    -- 5. Ledger log
    INSERT INTO public.ledger_logs (user_id, account_name, action_type, amount, previous_balance, new_balance, details)
    VALUES (p_user_id, (SELECT name FROM public.accounts WHERE id = p_account_id), 'INVESTMENT_MF', v_total_amount, v_account_curr_balance, v_account_curr_balance - v_total_amount, 'Purchased Mutual Fund: ' || p_fund_name);

    RETURN json_build_object('success', true, 'mf_id', v_mf_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
