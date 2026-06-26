-- Migration: Family Management RPCs
-- Date: 2026-06-26
-- Purpose: Create RPC functions for family transfers and allowance payments

-- ============================================================
-- 1. process_family_transfer_v2
--    Deducts from bank account, credits family member balance,
--    records transfer and ledger log atomically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_family_transfer_v2(
    p_user_id UUID,
    p_family_member_id UUID,
    p_account_id UUID,
    p_amount NUMERIC,
    p_type TEXT,
    p_note TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_member_name TEXT;
    v_details TEXT;
BEGIN
    -- Validate amount
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than zero';
    END IF;

    -- Lock and validate the bank account
    SELECT balance, name INTO v_old_balance, v_account_name
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found';
    END IF;

    IF v_old_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Validate the family member
    SELECT name INTO v_member_name
    FROM public.family_members
    WHERE id = p_family_member_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family member not found';
    END IF;

    -- Deduct from bank account
    v_new_balance := v_old_balance - p_amount;
    UPDATE public.accounts
    SET balance = v_new_balance
    WHERE id = p_account_id;

    -- Credit family member balance
    UPDATE public.family_members
    SET balance = balance + p_amount
    WHERE id = p_family_member_id AND user_id = p_user_id;

    -- Record the transfer
    v_details := 'Family transfer to ' || v_member_name
        || CASE WHEN p_note IS NOT NULL AND p_note != '' THEN ': ' || p_note ELSE '' END;

    INSERT INTO public.family_transfers (
        user_id, family_member_id, account_id, amount, type, note
    ) VALUES (
        p_user_id, p_family_member_id, p_account_id, p_amount, p_type, p_note
    );

    -- Log to ledger
    INSERT INTO public.ledger_logs (
        user_id, account_id, account_name, action_type,
        amount, previous_balance, new_balance, details, source_type
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 'ADJUST_DOWN',
        p_amount, v_old_balance, v_new_balance, v_details, 'family_transfer'
    );

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.process_family_transfer_v2(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_family_transfer_v2(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) TO service_role;


-- ============================================================
-- 2. pay_family_allowance
--    Reads allowance amount, deducts from bank account,
--    credits member balance, records transfer, updates last_paid_at.
-- ============================================================
CREATE OR REPLACE FUNCTION public.pay_family_allowance(
    p_user_id UUID,
    p_allowance_id UUID,
    p_account_id UUID
) RETURNS JSON AS $$
DECLARE
    v_allowance RECORD;
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_member_name TEXT;
    v_details TEXT;
BEGIN
    -- Fetch the allowance
    SELECT * INTO v_allowance
    FROM public.family_allowances
    WHERE id = p_allowance_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Allowance not found';
    END IF;

    -- Get the family member name
    SELECT name INTO v_member_name
    FROM public.family_members
    WHERE id = v_allowance.family_member_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family member not found';
    END IF;

    -- Lock and validate the bank account
    SELECT balance, name INTO v_old_balance, v_account_name
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found';
    END IF;

    IF v_old_balance < v_allowance.amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Deduct from bank account
    v_new_balance := v_old_balance - v_allowance.amount;
    UPDATE public.accounts
    SET balance = v_new_balance
    WHERE id = p_account_id;

    -- Credit family member balance
    UPDATE public.family_members
    SET balance = balance + v_allowance.amount
    WHERE id = v_allowance.family_member_id AND user_id = p_user_id;

    -- Record the transfer
    v_details := 'Allowance payment to ' || v_member_name
        || ' (' || v_allowance.frequency || ')';

    INSERT INTO public.family_transfers (
        user_id, family_member_id, account_id, amount, type, note
    ) VALUES (
        p_user_id, v_allowance.family_member_id, p_account_id,
        v_allowance.amount, 'allowance', v_details
    );

    -- Log to ledger
    INSERT INTO public.ledger_logs (
        user_id, account_id, account_name, action_type,
        amount, previous_balance, new_balance, details, source_type
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 'ADJUST_DOWN',
        v_allowance.amount, v_old_balance, v_new_balance, v_details, 'family_transfer'
    );

    -- Update last_paid_at on the allowance
    UPDATE public.family_allowances
    SET last_paid_at = NOW()
    WHERE id = p_allowance_id AND user_id = p_user_id;

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.pay_family_allowance(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_family_allowance(UUID, UUID, UUID) TO service_role;


-- ============================================================
-- 3. Enable Realtime for family tables
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'family_members'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.family_members;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'family_allowances'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.family_allowances;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'family_transfers'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.family_transfers;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Handle case where publication doesn't exist
        NULL;
END $$;
