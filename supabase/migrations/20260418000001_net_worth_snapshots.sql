-- Create net_worth_snapshots table for tracking net worth over time
CREATE TABLE IF NOT EXISTS public.net_worth_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_assets DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_liabilities DECIMAL(15, 2) NOT NULL DEFAULT 0,
    net_worth DECIMAL(15, 2) NOT NULL DEFAULT 0,
    accounts_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    investments_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, snapshot_date)
);

-- Create index for faster queries
CREATE INDEX idx_net_worth_snapshots_user_date ON public.net_worth_snapshots(user_id, snapshot_date DESC);

-- Enable RLS
ALTER TABLE public.net_worth_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own net worth snapshots"
    ON public.net_worth_snapshots
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own net worth snapshots"
    ON public.net_worth_snapshots
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own net worth snapshots"
    ON public.net_worth_snapshots
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own net worth snapshots"
    ON public.net_worth_snapshots
    FOR DELETE
    USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.net_worth_snapshots TO authenticated;
GRANT ALL ON public.net_worth_snapshots TO service_role;
