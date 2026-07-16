-- Migration: Restore accounts and transactions user foreign key constraints with ON DELETE CASCADE
-- Purpose: Ensures accounts.user_id and transactions.user_id correctly reference auth.users(id) with ON DELETE CASCADE

DO $$ 
DECLARE
    v_constraint_name text;
BEGIN
    -- 1. Fix accounts table
    SELECT tc.constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'accounts' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS ' || quote_ident(v_constraint_name);
    END IF;
    
    -- Delete orphaned accounts (where user_id does not exist in auth.users)
    DELETE FROM public.accounts WHERE user_id NOT IN (SELECT id FROM auth.users);

    ALTER TABLE public.accounts 
    ADD CONSTRAINT accounts_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 2. Fix transactions table
    v_constraint_name := NULL;
    SELECT tc.constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'transactions' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS ' || quote_ident(v_constraint_name);
    END IF;
    
    -- Delete orphaned transactions (where user_id does not exist in auth.users)
    DELETE FROM public.transactions WHERE user_id NOT IN (SELECT id FROM auth.users);

    ALTER TABLE public.transactions 
    ADD CONSTRAINT transactions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


END $$;
