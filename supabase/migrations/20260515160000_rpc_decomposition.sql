-- Migration: RPC Decomposition & Optimization
-- Purpose: Split the "Monster RPC" into domain-specific verticals for better performance, 
-- observability, and granular frontend caching (SWR).

-- 1. Dashboard Summary (High Frequency)
CREATE OR REPLACE FUNCTION get_summary_v1()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT json_build_object(
        'profile', (SELECT json_build_object('username', username, 'settings', settings) FROM public.profiles WHERE id = v_user_id),
        'accounts', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.accounts WHERE user_id = v_user_id ORDER BY balance DESC) t),
        'transactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.transactions WHERE user_id = v_user_id ORDER BY date DESC LIMIT 20) t),
        'ledgerLogs', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.ledger_logs WHERE user_id = v_user_id ORDER BY created_at DESC LIMIT 10) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Investments & Portfolio (Medium Frequency)
CREATE OR REPLACE FUNCTION get_investments_v1()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT json_build_object(
        'investments', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.investments WHERE user_id = v_user_id ORDER BY current_price * quantity DESC) t),
        'mutualFunds', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.mutual_funds WHERE user_id = v_user_id) t),
        'bonds', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.bonds WHERE user_id = v_user_id ORDER BY maturity_date ASC) t),
        'alternativeAssets', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.alternative_assets WHERE user_id = v_user_id ORDER BY current_value DESC) t),
        'stockTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.stock_trades WHERE user_id = v_user_id ORDER BY trade_date DESC LIMIT 50) t),
        'mutualFundTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.mutual_fund_trades WHERE user_id = v_user_id ORDER BY date DESC LIMIT 50) t),
        'bondTransactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.bond_transactions WHERE user_id = v_user_id ORDER BY transaction_date DESC LIMIT 50) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cashflow & Planning (Medium Frequency)
CREATE OR REPLACE FUNCTION get_cashflow_v1()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT json_build_object(
        'incomes', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.incomes WHERE user_id = v_user_id ORDER BY date DESC LIMIT 100) t),
        'expenses', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.expenses WHERE user_id = v_user_id ORDER BY date DESC LIMIT 100) t),
        'budgets', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.budgets WHERE user_id = v_user_id) t),
        'goals', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.goals WHERE user_id = v_user_id ORDER BY deadline ASC) t),
        'liabilities', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.liabilities WHERE user_id = v_user_id ORDER BY remaining_amount DESC) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Forex & Trading (High Frequency / Isolated)
CREATE OR REPLACE FUNCTION get_forex_v1()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT json_build_object(
        'forexAccounts', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.forex_accounts WHERE user_id = v_user_id) t),
        'forexTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.forex_trades WHERE user_id = v_user_id ORDER BY trade_date DESC LIMIT 100) t),
        'forexTransactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.forex_transactions WHERE user_id = v_user_id ORDER BY transaction_date DESC LIMIT 50) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Family & External (Low Frequency)
CREATE OR REPLACE FUNCTION get_family_v1()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT json_build_object(
        'recipients', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.recipients WHERE user_id = v_user_id ORDER BY name ASC) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
