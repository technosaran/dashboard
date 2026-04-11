-- Add account_id to expenses table
ALTER TABLE public.expenses 
ADD COLUMN account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Add index for account_id for performance
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);
