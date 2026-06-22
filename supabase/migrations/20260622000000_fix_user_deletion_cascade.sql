-- Migration: Fix User Deletion Cascade
-- Purpose: Adds ON DELETE CASCADE to user_id foreign keys in recipients, expenses, and incomes tables
-- to allow manual deletion of users from auth.users without foreign key constraint violations.

DO $$ 
DECLARE
    v_constraint_name text;
BEGIN
    -- 1. Fix recipients table
    SELECT tc.constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'recipients' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.recipients DROP CONSTRAINT IF EXISTS ' || quote_ident(v_constraint_name);
    END IF;
    
    ALTER TABLE public.recipients 
    ADD CONSTRAINT recipients_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 2. Fix expenses table
    v_constraint_name := NULL;
    SELECT tc.constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'expenses' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS ' || quote_ident(v_constraint_name);
    END IF;
    
    ALTER TABLE public.expenses 
    ADD CONSTRAINT expenses_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- 3. Fix incomes table
    v_constraint_name := NULL;
    SELECT tc.constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' 
      AND tc.table_name = 'incomes' 
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'user_id';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.incomes DROP CONSTRAINT IF EXISTS ' || quote_ident(v_constraint_name);
    END IF;
    
    ALTER TABLE public.incomes 
    ADD CONSTRAINT incomes_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

END $$;
