-- This migration adds a permanent "Cash" account for each user
-- The Cash account represents physical money held by the user

-- Note: This will be created automatically when users first load the accounts page
-- This file is just for documentation purposes

-- The Cash account will have:
-- - name: "Cash"
-- - type: "cash"
-- - balance: 0 (initially)
-- - Cannot be deleted through the UI
