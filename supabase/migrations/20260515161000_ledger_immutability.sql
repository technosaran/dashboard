-- Migration: Ledger Immutability Hardening
-- Purpose: Enforce fintech best practices by making the ledger_logs table append-only.
-- This ensures financial history cannot be deleted, even by the user.

-- 1. Drop the delete policy to prevent data tampering
DROP POLICY IF EXISTS "Users can delete their own ledger logs" ON public.ledger_logs;

-- 2. Verify only SELECT and INSERT exist
-- (Existing policies "Users can view their own ledger logs" and "Users can insert their own ledger logs" are maintained)

-- 3. Add a trigger to prevent manual UPDATES just in case a policy is added in the future
CREATE OR REPLACE FUNCTION protect_ledger_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ledger logs are immutable and cannot be modified.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_protect_ledger_immutability ON public.ledger_logs;
CREATE TRIGGER tr_protect_ledger_immutability
BEFORE UPDATE ON public.ledger_logs
FOR EACH ROW
EXECUTE FUNCTION protect_ledger_immutability();
