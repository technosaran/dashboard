
-- MF Real-time & Charges Migration
ALTER TABLE public.mutual_funds 
ADD COLUMN IF NOT EXISTS scheme_code TEXT,
ADD COLUMN IF NOT EXISTS expense_ratio NUMERIC DEFAULT 0;

ALTER TABLE public.mutual_fund_trades
ADD COLUMN IF NOT EXISTS stamp_duty NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS exit_load_details TEXT;

-- Update record_mf_investment to handle scheme_code and charges
CREATE OR REPLACE FUNCTION record_mf_investment_v2(
    p_user_id UUID,
    p_fund_name TEXT,
    p_scheme_code TEXT,
    p_units NUMERIC,
    p_nav NUMERIC,
    p_investment_type TEXT,
    p_category TEXT,
    p_amc_name TEXT,
    p_date DATE,
    p_account_id UUID,
    p_stamp_duty NUMERIC
) RETURNS JSON AS $$
DECLARE
    v_mf_id UUID;
    v_investment_amount NUMERIC;
    v_total_deduction NUMERIC;
    v_account_curr_balance NUMERIC;
BEGIN
    v_investment_amount := p_units * p_nav;
    v_total_deduction := v_investment_amount + p_stamp_duty;

    -- 1. Check account balance
    SELECT balance INTO v_account_curr_balance FROM public.accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
    IF v_account_curr_balance < v_total_deduction THEN
        RETURN json_build_object('error', 'Insufficient funds for investment + charges');
    END IF;

    -- 2. Update/Create Mutual Fund Holding
    -- Grouping by scheme_code if available
    INSERT INTO public.mutual_funds (user_id, fund_name, scheme_code, units, avg_nav, current_nav, investment_type, category, amc_name)
    VALUES (p_user_id, p_fund_name, p_scheme_code, p_units, p_nav, p_nav, p_investment_type, p_category, p_amc_name)
    ON CONFLICT (id) DO UPDATE SET -- Logic for manual match if ID provided, but we usually insert if no ID
        units = public.mutual_funds.units + p_units,
        avg_nav = (public.mutual_funds.units * public.mutual_funds.avg_nav + v_investment_amount) / (public.mutual_funds.units + p_units)
    RETURNING id INTO v_mf_id;

    -- 3. Log trade with charges
    INSERT INTO public.mutual_fund_trades (user_id, mf_id, fund_name, trade_type, units, nav, amount, date, stamp_duty)
    VALUES (p_user_id, v_mf_id, p_fund_name, 'BUY', p_units, p_nav, v_investment_amount, p_date, p_stamp_duty);

    -- 4. Deduct from account
    UPDATE public.accounts SET balance = balance - v_total_deduction WHERE id = p_account_id;

    -- 5. Ledger log
    INSERT INTO public.ledger_logs (user_id, account_name, action_type, amount, previous_balance, new_balance, details)
    VALUES (p_user_id, (SELECT name FROM public.accounts WHERE id = p_account_id), 'INVESTMENT_MF', v_total_deduction, v_account_curr_balance, v_account_curr_balance - v_total_deduction, 'Coin Buy: ' || p_fund_name || ' (Charges: ₹' || p_stamp_duty || ')');

    RETURN json_build_object('success', true, 'mf_id', v_mf_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
