-- Create recipients table
CREATE TABLE IF NOT EXISTS public.recipients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT NOT NULL,
    relationship TEXT, -- 'Family', 'Friend', 'Other'
    account_number TEXT,
    bank_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'recipients' AND policyname = 'Users can manage their own recipients'
    ) THEN
        CREATE POLICY "Users can manage their own recipients"
        ON public.recipients FOR ALL
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
        AND tablename = 'recipients'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.recipients;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
