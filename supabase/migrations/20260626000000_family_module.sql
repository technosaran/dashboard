-- Migration: Family Management Module Rebuild
-- Date: 2026-06-26
-- Purpose: Drop legacy recipients and create new family tables

-- 1. Drop legacy table and RPC
DROP FUNCTION IF EXISTS process_family_transfer(uuid, uuid, numeric, text, text);
DROP TABLE IF EXISTS public.recipients CASCADE;

-- 2. Create new tables
CREATE TABLE public.family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    balance NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.family_allowances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    frequency TEXT NOT NULL,
    last_paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.family_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL,
    transfer_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    note TEXT
);

-- 3. Enable RLS
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_transfers ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
CREATE POLICY "Users can view their own family members" ON public.family_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own family members" ON public.family_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own family members" ON public.family_members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own family members" ON public.family_members FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own family allowances" ON public.family_allowances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own family allowances" ON public.family_allowances FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own family allowances" ON public.family_allowances FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own family allowances" ON public.family_allowances FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own family transfers" ON public.family_transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own family transfers" ON public.family_transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own family transfers" ON public.family_transfers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own family transfers" ON public.family_transfers FOR DELETE USING (auth.uid() = user_id);

-- 5. Update reset_user_data
CREATE OR REPLACE FUNCTION public.reset_user_data(p_user_id UUID) RETURNS JSON AS $$
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;

    -- Set bypass flag to allow ledger log deletion
    PERFORM set_config('app.bypass_rls', 'true', true);

    -- Delete in order to respect FK constraints if any
    DELETE FROM public.bond_transactions WHERE user_id = p_user_id;
    DELETE FROM public.bonds WHERE user_id = p_user_id;
    DELETE FROM public.forex_transactions WHERE user_id = p_user_id;
    DELETE FROM public.forex_trades WHERE user_id = p_user_id;
    DELETE FROM public.forex_accounts WHERE user_id = p_user_id;
    DELETE FROM public.fno_trades WHERE user_id = p_user_id;
    DELETE FROM public.alternative_assets WHERE user_id = p_user_id;
    DELETE FROM public.liabilities WHERE user_id = p_user_id;
    DELETE FROM public.budgets WHERE user_id = p_user_id;
    DELETE FROM public.net_worth_snapshots WHERE user_id = p_user_id;
    
    DELETE FROM public.stock_trades WHERE user_id = p_user_id;
    DELETE FROM public.investments WHERE user_id = p_user_id;
    DELETE FROM public.mutual_fund_trades WHERE user_id = p_user_id;
    DELETE FROM public.mutual_funds WHERE user_id = p_user_id;
    
    DELETE FROM public.transactions WHERE user_id = p_user_id;
    DELETE FROM public.ledger_logs WHERE user_id = p_user_id;
    DELETE FROM public.transfers WHERE user_id = p_user_id;
    DELETE FROM public.expenses WHERE user_id = p_user_id;
    DELETE FROM public.incomes WHERE user_id = p_user_id;
    DELETE FROM public.goals WHERE user_id = p_user_id;
    
    -- Replace legacy recipients with new family tables
    DELETE FROM public.family_transfers WHERE user_id = p_user_id;
    DELETE FROM public.family_allowances WHERE user_id = p_user_id;
    DELETE FROM public.family_members WHERE user_id = p_user_id;
    
    DELETE FROM public.accounts WHERE user_id = p_user_id;

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reset_user_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_user_data(UUID) TO service_role;
