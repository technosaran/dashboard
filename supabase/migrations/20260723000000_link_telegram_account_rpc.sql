-- Migration: 20260723000000_link_telegram_account_rpc.sql
-- Purpose: Security Definer helper to link Telegram chat ID to profile securely bypassing RLS and duplicate key constraints.

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

    -- Find profile matching link code case-insensitively
    SELECT id, username INTO v_profile_id, v_username
    FROM public.profiles
    WHERE LOWER(telegram_link_code) = LOWER(p_link_code);

    IF v_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired link code.');
    END IF;

    -- Unlink any other profile that might be linked to this chat_id to prevent UNIQUE constraint violation
    UPDATE public.profiles
    SET telegram_chat_id = NULL
    WHERE telegram_chat_id = p_chat_id;

    -- Link the chat_id to the target profile and clear the single-use code
    UPDATE public.profiles
    SET telegram_chat_id = p_chat_id,
        telegram_link_code = NULL
    WHERE id = v_profile_id;

    -- Ensure a default bank account exists for this user so logging never fails
    IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE user_id = v_profile_id) THEN
        INSERT INTO public.accounts (user_id, name, type, balance, currency, notes)
        VALUES (v_profile_id, 'Main Account', 'Checking', 100000, 'INR', 'Default primary account');
    END IF;

    RETURN jsonb_build_object('success', true, 'username', v_username, 'profile_id', v_profile_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.link_telegram_account(TEXT, TEXT) TO anon, authenticated, service_role;
