-- Migration: Fix revert_ledger_log to run as SECURITY DEFINER
-- Date: 2026-06-25
-- Purpose: Convert revert_ledger_log back to SECURITY DEFINER.
--          Since the ledger_logs table is append-only for users (no DELETE policy),
--          a SECURITY INVOKER function cannot delete the ledger log entry being reverted.
--          Running as SECURITY DEFINER allows the system to perform this controlled deletion
--          while maintaining proper ownership checks inside the function.

ALTER FUNCTION public.revert_ledger_log(UUID, UUID) SECURITY DEFINER SET search_path = public;
