-- Migration: Fix reset_user_data function
-- Date: 2026-06-28
-- Purpose: Remove public.net_worth_snapshots from deletion routine since the table has been deleted.

CREATE OR REPLACE FUNCTION public.reset_user_data(p_user_id UUID) RETURNS JSON AS $$
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;

    -- Set bypass flag to allow ledger log deletion
    PERFORM set_config('app.bypass_rls', 'true', true);

    -- Delete in order to respect FK constraints if any
    DELETE FROM public.bond_transactions WHERE user_id = p_user_id;
    DELETE FROM public.bonds WHERE user_id = p_user_id;
    DELETE FROM public.forex_transactions WHERE user_id = p_user_id;
    DELETE FROM public.forex_trades WHERE user_id = p_user_id;
    DELETE FROM public.forex_accounts WHERE user_id = p_user_id;
    DELETE FROM public.fno_trades WHERE user_id = p_user_id;
    DELETE FROM public.alternative_assets WHERE user_id = p_user_id;
    DELETE FROM public.liabilities WHERE user_id = p_user_id;
    DELETE FROM public.budgets WHERE user_id = p_user_id;
    
    DELETE FROM public.stock_trades WHERE user_id = p_user_id;
    DELETE FROM public.investments WHERE user_id = p_user_id;
    DELETE FROM public.mutual_fund_trades WHERE user_id = p_user_id;
    DELETE FROM public.mutual_funds WHERE user_id = p_user_id;
    
    DELETE FROM public.transactions WHERE user_id = p_user_id;
    DELETE FROM public.ledger_logs WHERE user_id = p_user_id;
    DELETE FROM public.transfers WHERE user_id = p_user_id;
    DELETE FROM public.expenses WHERE user_id = p_user_id;
    DELETE FROM public.incomes WHERE user_id = p_user_id;
    DELETE FROM public.goals WHERE user_id = p_user_id;
    
    -- Replace legacy recipients with new family tables
    DELETE FROM public.family_transfers WHERE user_id = p_user_id;
    DELETE FROM public.family_allowances WHERE user_id = p_user_id;
    DELETE FROM public.family_members WHERE user_id = p_user_id;
    
    DELETE FROM public.accounts WHERE user_id = p_user_id;

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
