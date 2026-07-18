-- Migration: Add recurring columns to incomes table
-- Purpose: Supports tracking and auto-generation of recurring income streams

ALTER TABLE public.incomes
ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN recurrence_frequency TEXT,
ADD COLUMN recurrence_day INTEGER,
ADD COLUMN recurrence_end_date TIMESTAMP,
ADD COLUMN last_generated_date TIMESTAMP;
