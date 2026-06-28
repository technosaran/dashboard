-- Migration: Drop net_worth_snapshots table
-- Date: 2026-06-28
-- Purpose: Remove the unused net_worth_snapshots table from the database as requested.

DROP TABLE IF EXISTS public.net_worth_snapshots CASCADE;
