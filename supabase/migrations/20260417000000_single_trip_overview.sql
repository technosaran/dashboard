
-- CREATE SINGLE-TRIP FINANCE OVERVIEW FUNCTION
-- This significantly reduces the number of HTTP requests from the frontend
-- from 11+ calls down to 1 single RPC call.

CREATE OR REPLACE FUNCTION get_finance_overview()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_result JSON;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Return a combined JSON object of all necessary data
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
        'mutualFundTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.mutual_fund_trades WHERE user_id = v_user_id ORDER BY date DESC LIMIT 50) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
