-- Migration: 20260723000000_link_telegram_account_rpc.sql
-- Purpose: SECURITY DEFINER helpers for Telegram integration to bypass RLS restrictions safely for linked Telegram users.

-- 1. Link Telegram Account RPC
CREATE OR REPLACE FUNCTION public.link_telegram_account(
    p_link_code TEXT,
    p_chat_id TEXT
) RETURNS JSONB AS $$
DECLARE
    v_profile_id UUID;
    v_username TEXT;
BEGIN
    IF p_link_code IS NULL OR p_chat_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing link code or chat ID');
    END IF;

    SELECT id, username INTO v_profile_id, v_username
    FROM public.profiles
    WHERE LOWER(telegram_link_code) = LOWER(p_link_code);

    IF v_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired link code.');
    END IF;

    UPDATE public.profiles
    SET telegram_chat_id = NULL
    WHERE telegram_chat_id = p_chat_id;

    UPDATE public.profiles
    SET telegram_chat_id = p_chat_id,
        telegram_link_code = NULL
    WHERE id = v_profile_id;

    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = v_profile_id) THEN
        INSERT INTO public.accounts (user_id, name, type, balance, currency, notes)
        VALUES (v_profile_id, 'Main Account', 'Checking', 100000, 'INR', 'Default primary account');
    END IF;

    RETURN jsonb_build_object('success', true, 'username', v_username, 'profile_id', v_profile_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Get Telegram User Context RPC (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_telegram_user_context(p_chat_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_profile RECORD;
    v_accounts JSONB;
    v_family JSONB;
    v_goals JSONB;
    v_acc_count INT;
BEGIN
    SELECT id, username, base_currency, default_accounts INTO v_profile
    FROM public.profiles
    WHERE telegram_chat_id = p_chat_id;

    IF v_profile.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Telegram account not linked');
    END IF;

    SELECT COUNT(*) INTO v_acc_count FROM public.accounts WHERE user_id = v_profile.id;
    IF v_acc_count = 0 THEN
        INSERT INTO public.accounts (user_id, name, type, balance, currency, notes)
        VALUES (v_profile.id, 'Main Account', 'Checking', 100000, COALESCE(v_profile.base_currency, 'INR'), 'Default primary account');
    END IF;

    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_accounts
    FROM (SELECT id, name, notes, balance, type FROM public.accounts WHERE user_id = v_profile.id ORDER BY balance DESC) t;

    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_family
    FROM (SELECT id, name, relationship, balance FROM public.family_members WHERE user_id = v_profile.id) t;

    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_goals
    FROM (SELECT id, name, target_amount, current_amount FROM public.goals WHERE user_id = v_profile.id) t;

    RETURN jsonb_build_object(
        'success', true,
        'profile', jsonb_build_object(
            'id', v_profile.id,
            'username', v_profile.username,
            'base_currency', v_profile.base_currency,
            'default_accounts', v_profile.default_accounts
        ),
        'accounts', v_accounts,
        'familyMembers', v_family,
        'goals', v_goals
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Record Telegram Transaction RPC (bypasses RLS)
CREATE OR REPLACE FUNCTION public.record_telegram_transaction(
    p_chat_id TEXT,
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_type TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_target_acc UUID := p_account_id;
BEGIN
    SELECT id INTO v_user_id FROM public.profiles WHERE telegram_chat_id = p_chat_id;
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Telegram account not linked');
    END IF;

    IF v_target_acc IS NULL THEN
        SELECT id INTO v_target_acc FROM public.accounts WHERE user_id = v_user_id ORDER BY balance DESC LIMIT 1;
    END IF;

    IF v_target_acc IS NULL THEN
        INSERT INTO public.accounts (user_id, name, type, balance, currency, notes)
        VALUES (v_user_id, 'Main Account', 'Checking', 100000, 'INR', 'Default primary account')
        RETURNING id INTO v_target_acc;
    END IF;

    IF p_type = 'income' THEN
        RETURN public.record_income(v_user_id, p_description, p_amount, p_category, p_date, v_target_acc);
    ELSE
        RETURN public.record_expense(v_user_id, p_description, p_amount, p_category, p_date, v_target_acc);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.link_telegram_account(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_telegram_user_context(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_telegram_transaction(TEXT, TEXT, NUMERIC, TEXT, TEXT, DATE, UUID) TO anon, authenticated, service_role;
