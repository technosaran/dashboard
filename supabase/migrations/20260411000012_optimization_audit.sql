
-- Optimization Audit & Performance Layer
-- This migration adds missing indexes, constraints, and structural optimizations

-- 1. CLUSTERING & PERFORMANCE INDEXES
-- Better for ledger history and dashboard performance
CREATE INDEX IF NOT EXISTS idx_ledger_logs_user_created_at ON public.ledger_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_recipients_user_id ON public.recipients(user_id);

-- 2. DATA INTEGRITY CONSTRAINTS
-- Ensure amounts are logically sound at the DB level
ALTER TABLE public.expenses ADD CONSTRAINT check_expense_amount_positive CHECK (amount >= 0);
ALTER TABLE public.transfers ADD CONSTRAINT check_transfer_amount_positive CHECK (amount > 0);
ALTER TABLE public.ledger_logs ADD CONSTRAINT check_ledger_amount_non_negative CHECK (amount >= 0);

-- 3. STORAGE OPTIMIZATION (ENUMS)
-- Define strict types for better storage and validation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_category') THEN
        CREATE TYPE account_category AS ENUM ('checking', 'savings', 'credit', 'investment', 'cash');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_action') THEN
        CREATE TYPE ledger_action AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUST_UP', 'ADJUST_DOWN', 'LOG_ONLY', 'SEND_MONEY');
    END IF;
END $$;

-- Note: In a production environment, changing TEXT columns to ENUM columns requires a migration strategy:
-- ALTER TABLE accounts ALTER COLUMN type TYPE account_category USING type::account_category;
-- For now, we keep the TEXT columns but add validation constraints to simulate Enums without breaking existing code.

ALTER TABLE public.accounts ADD CONSTRAINT valid_account_type 
CHECK (type IN ('checking', 'savings', 'credit', 'investment', 'cash'));

ALTER TABLE public.ledger_logs ADD CONSTRAINT valid_ledger_action 
CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUST_UP', 'ADJUST_DOWN', 'LOG_ONLY', 'SEND_MONEY'));

-- 4. VACUUM & ANALYZE OPTIMIZATION
-- Ensure Postgres handles these frequently updated tables efficiently
ALTER TABLE public.accounts SET (fillfactor = 90); -- Leave room for balance updates without moving rows
ALTER TABLE public.ledger_logs SET (fillfactor = 100); -- Insert-only table

-- 5. ANALYTICS VIEWS (Performance Layer)
-- Pre-calculates data to reduce frontend computation
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT 
    user_id,
    currency,
    SUM(balance) as total_balance,
    COUNT(id) as account_count
FROM public.accounts
GROUP BY user_id, currency;

CREATE OR REPLACE VIEW monthly_spending AS
SELECT 
    user_id,
    SUM(amount) as total_monthly_amount,
    COUNT(id) as transaction_count,
    date_trunc('month', date) as month
FROM public.expenses
GROUP BY user_id, date_trunc('month', date);
