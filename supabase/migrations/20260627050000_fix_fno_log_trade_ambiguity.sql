-- Migration: Fix ambiguous fno_log_trade function overload
-- Date: 2026-06-27
-- Purpose: Drop the old INTEGER overload of fno_log_trade that conflicts with the NUMERIC version.
-- The 20260614000000 migration created fno_log_trade with p_quantity INTEGER,
-- and 20260619130000 created a new overload with p_quantity NUMERIC(18,6).
-- PostgreSQL treats these as two separate functions, causing "could not choose best candidate" errors.

-- Drop the old INTEGER overload (from 20260614000000_fix_fno_ledger_immutability.sql)
DROP FUNCTION IF EXISTS public.fno_log_trade(UUID, TEXT, TEXT, NUMERIC, DATE, TEXT, INTEGER, NUMERIC, UUID, TEXT, DATE);

-- The NUMERIC version from 20260619130000 remains as the sole definition.
