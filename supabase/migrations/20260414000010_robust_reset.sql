
-- Robust Reset Function that checks for table existence before deleting
CREATE OR REPLACE FUNCTION reset_user_data(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_total_deleted INTEGER := 0;
    v_row_count INTEGER;
    v_table_name TEXT;
    v_tables TEXT[] := ARRAY[
        'ledger_logs', 'transactions', 'transfers', 'expenses', 
        'incomes', 'deposits', 'stock_trades', 'investments', 
        'mutual_fund_trades', 'mutual_funds', 'goals', 'recipients', 'accounts'
    ];
BEGIN
    FOR i IN 1 .. array_upper(v_tables, 1) LOOP
        v_table_name := v_tables[i];
        
        -- Only attempt delete if table exists in public schema
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = v_table_name
        ) THEN
            EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_table_name) USING p_user_id;
            GET DIAGNOSTICS v_row_count = ROW_COUNT;
            v_total_deleted := v_total_deleted + v_row_count;
        END IF;
    END LOOP;

    RETURN json_build_object(
        'success', true, 
        'message', 'Institutional Reset Complete',
        'records_erased', v_total_deleted
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reset_user_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_data(UUID) TO service_role;
