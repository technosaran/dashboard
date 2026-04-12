-- Migration: Performance Indexing Audit
-- Purpose: Add missing indexes to new tables to prevent table scans as data grows

-- 1. Ledger Logs
CREATE INDEX IF NOT EXISTS idx_ledger_logs_user_id ON public.ledger_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_logs_account_id ON public.ledger_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_logs_source_id ON public.ledger_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_logs_created_at ON public.ledger_logs(created_at DESC);

-- 2. Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);

-- 3. Recipients (Family)
CREATE INDEX IF NOT EXISTS idx_recipients_user_id ON public.recipients(user_id);

-- 4. Incomes (Already indexed in its own migration, but ensuring coverage)
CREATE INDEX IF NOT EXISTS idx_incomes_date ON public.incomes(date DESC);
