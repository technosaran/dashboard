-- Migration: Security Linter Fixes
-- Purpose: Revoke execution rights from public/anon roles for all SECURITY DEFINER functions,
-- and set search_path = public for all functions to prevent search path hijacking.

-- 1. Set search_path = public for ALL functions in public schema to resolve search path warnings
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure AS sig 
        FROM pg_proc 
        WHERE pronamespace = 'public'::regnamespace
    ) LOOP
        BEGIN
            EXECUTE 'ALTER FUNCTION ' || r.sig || ' SET search_path = public;';
        EXCEPTION WHEN OTHERS THEN
            -- Ignore any functions that cannot be altered (e.g. system functions)
            NULL;
        END;
    END LOOP;
END $$;

-- 2. Revoke execute from PUBLIC and grant to authenticated, service_role for all SECURITY DEFINER functions
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure AS sig 
        FROM pg_proc 
        WHERE pronamespace = 'public'::regnamespace
          AND prosecdef = true
    ) LOOP
        BEGIN
            -- Revoke execute from public (which includes anonymous requests)
            EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM public;';
            EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM anon;';
            
            -- Grant to authenticated & service_role
            EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated, service_role;';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END $$;
