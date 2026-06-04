-- Migration: Security Definer search_path Hardening
-- Date: 2026-06-04
-- Purpose: Harden all remaining SECURITY DEFINER functions by setting search_path = public to prevent search path hijacking vulnerabilities.

-- 1. Profiles trigger: handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Profiles trigger: handle_user_update
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET 
    username = new.raw_user_meta_data->>'username',
    updated_at = NOW()
  WHERE id = new.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. get_summary_v1
CREATE OR REPLACE FUNCTION public.get_summary_v1()
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. get_investments_v1
CREATE OR REPLACE FUNCTION public.get_investments_v1()
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
        'bondTransactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.bond_transactions WHERE user_id = v_user_id ORDER BY transaction_date DESC LIMIT 50) t),
        'fnoTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.fno_trades WHERE user_id = v_user_id ORDER BY trade_date DESC, created_at DESC) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. get_cashflow_v1
CREATE OR REPLACE FUNCTION public.get_cashflow_v1()
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. get_forex_v1
CREATE OR REPLACE FUNCTION public.get_forex_v1()
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. get_family_v1
CREATE OR REPLACE FUNCTION public.get_family_v1()
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. get_finance_overview_v2
CREATE OR REPLACE FUNCTION public.get_finance_overview_v2()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_summary JSON;
    v_investments JSON;
    v_cashflow JSON;
    v_forex JSON;
    v_family JSON;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Call vertical functions
    v_summary := public.get_summary_v1();
    v_investments := public.get_investments_v1();
    v_cashflow := public.get_cashflow_v1();
    v_forex := public.get_forex_v1();
    v_family := public.get_family_v1();

    -- Merge results into a single object
    RETURN (
        v_summary::JSONB || 
        v_investments::JSONB || 
        v_cashflow::JSONB || 
        v_forex::JSONB || 
        v_family::JSONB
    )::JSON;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
