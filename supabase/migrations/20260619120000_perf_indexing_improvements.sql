-- Migration: Additional Indexing Performance Improvements
-- Date: 2026-06-19
-- Purpose: Add a composite index on transactions(user_id, category, date DESC) to optimize category-based cashflow reporting.

-- 1. Index transactions by user_id, category, and date DESC
CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date ON public.transactions(user_id, category, date DESC);
