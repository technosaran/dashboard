-- Enable Realtime for all core tables to ensure cross-device synchronization
-- This ensures that any change made on one device (Phone) is broadcasted to all other devices (Desktop) instantly.

-- 1. Ensure the publication exists (Supabase usually creates this by default)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Add tables to the publication
-- We use a DO block to safely add tables only if they aren't already part of the publication
DO $$
DECLARE
    tables_to_add TEXT[] := ARRAY['accounts', 'transfers', 'transactions', 'deposits', 'profiles'];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables_to_add LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table is already in the publication, ignore
                NULL;
            WHEN undefined_table THEN
                -- Table doesn't exist yet, ignore
                NULL;
        END;
    END LOOP;
END $$;

