-- Settings Schema Upgrade

-- 1. Add new strict columns to profiles
ALTER TABLE public.profiles
ADD COLUMN base_currency TEXT DEFAULT 'INR' NOT NULL,
ADD COLUMN theme TEXT DEFAULT 'system' NOT NULL,
ADD COLUMN timezone TEXT DEFAULT 'Asia/Kolkata' NOT NULL,
ADD COLUMN enabled_modules JSONB DEFAULT '["Accounts", "Expenses", "Income", "Family", "Forex", "Stocks", "Mutual Funds", "Bonds", "Alt Assets", "Liabilities", "Ledger", "Goals", "Budget", "FnO"]'::jsonb NOT NULL,
ADD COLUMN default_accounts JSONB DEFAULT '{}'::jsonb NOT NULL;

-- 2. Migrate existing JSONB settings into the new columns
DO $$
DECLARE
    r RECORD;
    v_enabled_modules JSONB;
    v_default_accounts JSONB;
BEGIN
    FOR r IN SELECT id, settings FROM public.profiles WHERE settings IS NOT NULL
    LOOP
        -- Extract enabled_modules if present
        IF r.settings ? 'enabled_modules' THEN
            v_enabled_modules := r.settings->'enabled_modules';
        ELSE
            v_enabled_modules := '["Accounts", "Expenses", "Income", "Family", "Forex", "Stocks", "Mutual Funds", "Bonds", "Alt Assets", "Liabilities", "Ledger", "Goals", "Budget", "FnO"]'::jsonb;
        END IF;

        -- Extract default_accounts if present
        IF r.settings ? 'default_accounts' THEN
            v_default_accounts := r.settings->'default_accounts';
        ELSE
            v_default_accounts := '{}'::jsonb;
        END IF;

        -- Update the profile
        UPDATE public.profiles
        SET 
            enabled_modules = v_enabled_modules,
            default_accounts = v_default_accounts
        WHERE id = r.id;
    END LOOP;
END;
$$;

-- 3. Drop the old unvalidated settings column
ALTER TABLE public.profiles DROP COLUMN settings;

-- 4. Update the get_summary_v1 RPC to return the new flattened profile structure
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
            'default_accounts', default_accounts
        ) FROM public.profiles WHERE id = v_user_id),
        'accounts', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.accounts WHERE user_id = v_user_id ORDER BY balance DESC) t),
        'transactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.transactions WHERE user_id = v_user_id ORDER BY date DESC LIMIT 20) t),
        'ledgerLogs', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.ledger_logs WHERE user_id = v_user_id ORDER BY created_at DESC LIMIT 10) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
