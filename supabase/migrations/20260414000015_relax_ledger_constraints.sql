
-- Migration: Relax Ledger Action Constraint
-- Purpose: Support new action types like INVESTMENT_MF and GOAL_CONTRIBUTION without breaking data integrity.

-- 1. Drop the restrictive constraint
ALTER TABLE IF EXISTS public.ledger_logs DROP CONSTRAINT IF EXISTS valid_ledger_action;

-- 2. Re-add with a much more comprehensive list
-- This includes legacy types and future expansion types.
ALTER TABLE public.ledger_logs ADD CONSTRAINT valid_ledger_action 
CHECK (action_type IN (
    'CREATE', 
    'UPDATE', 
    'DELETE', 
    'TRANSFER_IN', 
    'TRANSFER_OUT', 
    'ADJUST_UP', 
    'ADJUST_DOWN', 
    'LOG_ONLY', 
    'SEND_MONEY', 
    'SEND_MONEY_IN', 
    'INVESTMENT_MF', 
    'INVESTMENT_STOCK', 
    'INVESTMENT_GOLD', 
    'GOAL_INIT', 
    'GOAL_CONTRIBUTION', 
    'GOAL_WITHDRAWAL', 
    'REVERSAL'
));
