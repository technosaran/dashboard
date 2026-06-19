-- Migration: Convert Security Definer Functions to Security Invoker
-- Date: 2026-06-19
-- Purpose: Convert all application functions to SECURITY INVOKER to satisfy security linter rules,
--          except triggers (handle_new_user, handle_user_update) which require DEFINER to perform system updates.

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.prosecdef = true
          -- Exclude functions owned by extensions (e.g. pgmq)
          AND NOT EXISTS (
              SELECT 1 
              FROM pg_depend d 
              WHERE d.objid = p.oid 
                AND d.deptype = 'e'
          )
          -- Exclude system trigger functions that require SECURITY DEFINER privileges to run correctly
          AND p.proname NOT IN ('handle_new_user', 'handle_user_update')
    ) LOOP
        BEGIN
            EXECUTE 'ALTER FUNCTION ' || r.sig || ' SECURITY INVOKER;';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping function %: %', r.sig, SQLERRM;
        END;
    END LOOP;
END $$;
