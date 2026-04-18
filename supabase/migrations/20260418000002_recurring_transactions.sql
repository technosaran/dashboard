-- Add recurring transaction fields to expenses table
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT CHECK (recurrence_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS recurrence_day INTEGER CHECK (recurrence_day >= 1 AND recurrence_day <= 31),
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
ADD COLUMN IF NOT EXISTS last_generated_date DATE;

-- Create index for recurring expenses queries
CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON public.expenses(user_id, is_recurring) WHERE is_recurring = TRUE;

-- Add comment
COMMENT ON COLUMN public.expenses.is_recurring IS 'Whether this expense recurs automatically';
COMMENT ON COLUMN public.expenses.recurrence_frequency IS 'How often the expense recurs: daily, weekly, monthly, yearly';
COMMENT ON COLUMN public.expenses.recurrence_day IS 'Day of month (1-31) when monthly expense recurs';
COMMENT ON COLUMN public.expenses.recurrence_end_date IS 'Optional end date for recurring expense';
COMMENT ON COLUMN public.expenses.last_generated_date IS 'Last date when a recurring instance was generated';
