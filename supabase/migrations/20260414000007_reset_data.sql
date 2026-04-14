
-- Function to completely erase all financial data for a user
CREATE OR REPLACE FUNCTION reset_user_data(p_user_id UUID)
RETURNS JSON AS $$
BEGIN
    -- Delete in reverse order of dependencies where applicable
    DELETE FROM public.ledger_logs WHERE user_id = p_user_id;
    DELETE FROM public.transactions WHERE user_id = p_user_id;
    DELETE FROM public.transfers WHERE user_id = p_user_id;
    DELETE FROM public.expenses WHERE user_id = p_user_id;
    DELETE FROM public.incomes WHERE user_id = p_user_id;
    DELETE FROM public.deposits WHERE user_id = p_user_id;
    DELETE FROM public.stock_trades WHERE user_id = p_user_id;
    DELETE FROM public.investments WHERE user_id = p_user_id;
    DELETE FROM public.mutual_fund_trades WHERE user_id = p_user_id;
    DELETE FROM public.mutual_funds WHERE user_id = p_user_id;
    DELETE FROM public.goals WHERE user_id = p_user_id;
    DELETE FROM public.recipients WHERE user_id = p_user_id;
    DELETE FROM public.accounts WHERE user_id = p_user_id;

    RETURN json_build_object('success', true, 'message', 'All data erased completely');
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
