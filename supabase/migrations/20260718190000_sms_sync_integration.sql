-- SMS Sync Integration migration

-- 1. Add sms_sync_token to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS sms_sync_token TEXT UNIQUE;

-- 2. Create index on the token for speed
CREATE INDEX IF NOT EXISTS profiles_sms_sync_token_idx ON public.profiles(sms_sync_token);

-- 3. Update get_summary_v1 RPC to include sms_sync_token

-- Re-create the function properly with the new column
CREATE OR REPLACE FUNCTION public.get_summary_v1()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT json_build_object(
        'profile', (SELECT json_build_object(
            'username', username, 
            'base_currency', base_currency,
            'theme', theme,
            'timezone', timezone,
            'enabled_modules', enabled_modules,
            'default_accounts', default_accounts,
            'sms_sync_token', sms_sync_token
        ) FROM public.profiles WHERE id = v_user_id),
        'accounts', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.accounts WHERE user_id = v_user_id ORDER BY balance DESC) t),
        'transactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.transactions WHERE user_id = v_user_id ORDER BY date DESC LIMIT 20) t),
        'ledgerLogs', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.ledger_logs WHERE user_id = v_user_id ORDER BY created_at DESC LIMIT 10) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Create record_expense_by_sms secure definer helper
CREATE OR REPLACE FUNCTION public.record_expense_by_sms(
    p_token TEXT,
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Look up the user_id associated with this token
    SELECT id INTO v_user_id FROM public.profiles WHERE sms_sync_token = p_token;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid sync token');
    END IF;

    -- Call standard record_expense (which bypasses auth checks since auth.role() is not 'authenticated')
    RETURN public.record_expense(v_user_id, p_description, p_amount, p_category, p_date, p_account_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create record_income_by_sms secure definer helper
CREATE OR REPLACE FUNCTION public.record_income_by_sms(
    p_token TEXT,
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Look up the user_id associated with this token
    SELECT id INTO v_user_id FROM public.profiles WHERE sms_sync_token = p_token;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid sync token');
    END IF;

    -- Call standard record_income (which bypasses auth checks since auth.role() is not 'authenticated')
    RETURN public.record_income(v_user_id, p_description, p_amount, p_category, p_date, p_account_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Grant execute permissions on these functions to both anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.record_expense_by_sms(TEXT, TEXT, NUMERIC, TEXT, DATE, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_income_by_sms(TEXT, TEXT, NUMERIC, TEXT, DATE, UUID) TO anon, authenticated;
