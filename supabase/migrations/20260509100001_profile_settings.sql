-- Add settings column to profiles to store user preferences like enabled modules
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{"enabled_modules": ["Income", "Expenses", "Budget", "Stocks", "Mutual Funds", "Alt Assets", "Bonds", "Liabilities", "Goals", "Family", "Forex", "Ledger"]}'::jsonb;

-- Update the get_finance_overview RPC to include the profile settings
CREATE OR REPLACE FUNCTION get_finance_overview()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_result JSON;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT json_build_object(
        'profile', (SELECT json_build_object('username', username, 'settings', settings) FROM public.profiles WHERE id = v_user_id),
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
        'forexTransactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.forex_transactions WHERE user_id = v_user_id ORDER BY transaction_date DESC LIMIT 50) t),
        'budgets', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.budgets WHERE user_id = v_user_id) t),
        'alternativeAssets', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.alternative_assets WHERE user_id = v_user_id ORDER BY current_value DESC) t),
        'liabilities', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.liabilities WHERE user_id = v_user_id ORDER BY due_date ASC) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
