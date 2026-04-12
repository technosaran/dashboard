-- Create incomes table
CREATE TABLE IF NOT EXISTS public.incomes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL, -- 'Salary', 'Work', 'Gift', 'Freelance', 'Bonus', 'Refund', 'Others'
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'incomes' AND policyname = 'Users can manage their own incomes'
    ) THEN
        CREATE POLICY "Users can manage their own incomes"
        ON public.incomes FOR ALL
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Enable Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'incomes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.incomes;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Indexing
CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON public.incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_account_id ON public.incomes(account_id);

-- RPC function to record income with proper transaction logic
CREATE OR REPLACE FUNCTION record_income(
    p_user_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_income_id UUID;
BEGIN
    -- 1. If account is provided, handle balance increment
    IF p_account_id IS NOT NULL THEN
        -- Lock the account row for update to prevent race conditions
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Account not found or access denied';
        END IF;

        v_new_balance := v_old_balance + p_amount;

        -- Update balance
        UPDATE accounts 
        SET balance = v_new_balance
        WHERE id = p_account_id;

        -- Log to ledger_logs
        INSERT INTO ledger_logs (
            user_id, account_id, account_name, action_type, 
            amount, previous_balance, new_balance, details
        ) VALUES (
            p_user_id, p_account_id, v_account_name, 'ADJUST_UP', 
            p_amount, v_old_balance, v_new_balance, 
            'Income: ' || p_description || ' (' || p_category || ')'
        );

        -- Log to transactions table (Core account history)
        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date
        ) VALUES (
            p_user_id, p_account_id, p_description, p_amount, 'income', p_category, p_date
        );
    END IF;

    -- 2. Insert into incomes table
    INSERT INTO incomes (
        user_id, account_id, description, amount, category, date
    ) VALUES (
        p_user_id, p_account_id, p_description, p_amount, p_category, p_date
    ) RETURNING id INTO v_income_id;

    RETURN jsonb_build_object(
        'success', true,
        'income_id', v_income_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
