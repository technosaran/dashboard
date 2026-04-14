
-- Migration: Transaction Integrity & Unified Linking
-- Purpose: Add explicit linkage to transactions table to eliminate fuzzy matching in reversals and improve auditing.

-- 1. Add linkage columns to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS source_type TEXT; -- 'income', 'expense', 'investment', 'family_transfer', etc.
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ledger_log_id UUID;

-- 2. Add indexes for these new columns
CREATE INDEX IF NOT EXISTS idx_transactions_source_id ON public.transactions(source_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_log_id ON public.transactions(ledger_log_id);

-- 3. HEALING: Attempt to link existing transactions to ledger logs where possible
-- This is best-effort to reduce debt
UPDATE public.transactions t
SET ledger_log_id = l.id,
    source_id = l.source_id,
    source_type = l.source_type
FROM public.ledger_logs l
WHERE t.user_id = l.user_id
  AND t.account_id = l.account_id
  AND t.amount = l.amount
  AND t.ledger_log_id IS NULL
  AND l.source_id IS NOT NULL
  AND (l.details LIKE '%' || t.description || '%' OR t.description LIKE '%' || l.details || '%');
