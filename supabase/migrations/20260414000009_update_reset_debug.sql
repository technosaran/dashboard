
-- Update the reset function to use the diagnostic logic
CREATE OR REPLACE FUNCTION reset_user_data(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_count_ledger INTEGER;
    v_count_accounts INTEGER;
    v_count_investments INTEGER;
BEGIN
    -- Delete in reverse order of dependencies
    DELETE FROM public.ledger_logs WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count_ledger = ROW_COUNT;
    
    DELETE FROM public.transactions WHERE user_id = p_user_id;
    DELETE FROM public.transfers WHERE user_id = p_user_id;
    DELETE FROM public.expenses WHERE user_id = p_user_id;
    DELETE FROM public.incomes WHERE user_id = p_user_id;
    DELETE FROM public.deposits WHERE user_id = p_user_id;
    DELETE FROM public.stock_trades WHERE user_id = p_user_id;
    
    DELETE FROM public.investments WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count_investments = ROW_COUNT;
    
    DELETE FROM public.mutual_fund_trades WHERE user_id = p_user_id;
    DELETE FROM public.mutual_funds WHERE user_id = p_user_id;
    DELETE FROM public.goals WHERE user_id = p_user_id;
    DELETE FROM public.recipients WHERE user_id = p_user_id;
    
    DELETE FROM public.accounts WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count_accounts = ROW_COUNT;

    RETURN json_build_object(
        'success', true, 
        'message', 'Erased ' || (v_count_ledger + v_count_accounts + v_count_investments) || ' main records',
        'details', json_build_object(
            'ledger', v_count_ledger,
            'investments', v_count_investments,
            'accounts', v_count_accounts
        )
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reset_user_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_data(UUID) TO service_role;
