-- Gmail Sync Integration migration

-- 1. Add gmail_refresh_token to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT;

-- 2. Update get_summary_v1 RPC to include is_gmail_linked flag
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
            'sms_sync_token', sms_sync_token,
            'is_gmail_linked', (gmail_refresh_token IS NOT NULL)
        ) FROM public.profiles WHERE id = v_user_id),
        'accounts', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.accounts WHERE user_id = v_user_id ORDER BY balance DESC) t),
        'transactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.transactions WHERE user_id = v_user_id ORDER BY date DESC LIMIT 20) t),
        'ledgerLogs', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.ledger_logs WHERE user_id = v_user_id ORDER BY created_at DESC LIMIT 10) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
