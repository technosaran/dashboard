-- Migration: Fix Database Linter Warnings
-- Date: 2026-06-19
-- Purpose: Convert read-only overview functions to SECURITY INVOKER and revoke public execute rights on SECURITY DEFINER functions.

-- 1. Switch read-only overview functions to SECURITY INVOKER
ALTER FUNCTION IF EXISTS public.get_summary_v1() SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.get_investments_v1() SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.get_cashflow_v1() SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.get_forex_v1() SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.get_family_v1() SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.get_finance_overview_v2() SECURITY INVOKER;
ALTER FUNCTION IF EXISTS public.get_finance_overview() SECURITY INVOKER;

-- 2. Revoke execute on trigger functions from all roles (they only run via trigger context)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_update() FROM public, anon, authenticated;

-- 3. Revoke public/anon execute on all SECURITY DEFINER functions in public schema dynamically
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.oid::regprocedure AS sig, t.typname AS return_type
        FROM pg_proc p
        JOIN pg_type t ON p.prorettype = t.oid
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.prosecdef = true
          AND NOT EXISTS (
              SELECT 1 
              FROM pg_depend d 
              WHERE d.objid = p.oid 
                AND d.deptype = 'e'
          )
    ) LOOP
        BEGIN
            IF r.return_type = 'trigger' THEN
                -- Revoke execute from everyone for trigger functions
                EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM public, anon, authenticated;';
            ELSE
                -- Revoke execute from public/anon for regular security definer functions
                EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM public;';
                EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM anon;';
                EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated, service_role;';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Safely skip functions we cannot modify (e.g. system or extension owned)
            RAISE NOTICE 'Skipping function % due to error: %', r.sig, SQLERRM;
        END;
    END LOOP;
END $$;

