-- Add source tracking columns to ledger_logs for deep reversal capability
ALTER TABLE public.ledger_logs 
ADD COLUMN IF NOT EXISTS source_id UUID,
ADD COLUMN IF NOT EXISTS source_type TEXT; -- 'expense', 'transaction', 'transfer'
