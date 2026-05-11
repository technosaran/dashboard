
-- Fix for Reset Logic: Remove non-existent recurring_transactions table
CREATE OR REPLACE FUNCTION reset_user_data(p_user_id UUID) RETURNS JSON AS $$
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;

    -- Delete in order to respect FK constraints if any
    DELETE FROM public.bond_transactions WHERE user_id = p_user_id;
    DELETE FROM public.bonds WHERE user_id = p_user_id;
    DELETE FROM public.forex_transactions WHERE user_id = p_user_id;
    DELETE FROM public.forex_trades WHERE user_id = p_user_id;
    DELETE FROM public.forex_accounts WHERE user_id = p_user_id;
    DELETE FROM public.alternative_assets WHERE user_id = p_user_id;
    DELETE FROM public.liabilities WHERE user_id = p_user_id;
    DELETE FROM public.budgets WHERE user_id = p_user_id;
    DELETE FROM public.net_worth_snapshots WHERE user_id = p_user_id;
    
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
    DELETE FROM public.recipients WHERE user_id = p_user_id;
    DELETE FROM public.accounts WHERE user_id = p_user_id;

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
