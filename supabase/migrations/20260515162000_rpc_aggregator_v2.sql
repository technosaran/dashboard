-- Migration: Master RPC Aggregator (v2)
-- Purpose: Provide a clean, single entry point for server-side prefetching 
-- while internally utilizing the decomposed vertical functions for maintainability.

CREATE OR REPLACE FUNCTION get_finance_overview_v2()
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
    v_summary := get_summary_v1();
    v_investments := get_investments_v1();
    v_cashflow := get_cashflow_v1();
    v_forex := get_forex_v1();
    v_family := get_family_v1();

    -- Merge results into a single object
    -- Note: jsonb_concat would be easier but we are using JSON for compatibility with existing types
    RETURN (
        v_summary::JSONB || 
        v_investments::JSONB || 
        v_cashflow::JSONB || 
        v_forex::JSONB || 
        v_family::JSONB
    )::JSON;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
