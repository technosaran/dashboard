
-- Create ledger_logs table
CREATE TABLE IF NOT EXISTS public.ledger_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    account_id UUID,
    account_name TEXT,
    action_type TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUST_UP', 'ADJUST_DOWN'
    amount DECIMAL(20, 2),
    previous_balance DECIMAL(20, 2),
    new_balance DECIMAL(20, 2),
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ledger_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ledger_logs' AND policyname = 'Users can view their own ledger logs'
    ) THEN
        CREATE POLICY "Users can view their own ledger logs"
        ON public.ledger_logs FOR SELECT
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ledger_logs' AND policyname = 'Users can insert their own ledger logs'
    ) THEN
        CREATE POLICY "Users can insert their own ledger logs"
        ON public.ledger_logs FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Enable Realtime
-- Check if table is already in publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'ledger_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ledger_logs;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Handle case where publication doesn't exist
        NULL;
END $$;
