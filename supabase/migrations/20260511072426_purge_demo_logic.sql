
-- Purge all demo-related seeding logic from the database
-- These functions were used for one-time initialization and are no longer needed in production.

DROP FUNCTION IF EXISTS public.seed_demo_data();
DROP FUNCTION IF EXISTS public.seed_demo_data_v2(UUID);
DROP FUNCTION IF EXISTS public.seed_demo_data_v3(UUID);
