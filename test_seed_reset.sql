BEGIN;
-- 1. Simulate authentication
SET LOCAL request.jwt.claims = '{"role": "authenticated", "sub": "ab12a3f3-75ef-4822-a1b3-7994c546deb1"}';

-- 2. Populate data using generate_sample_data
SELECT generate_sample_data();

-- 3. Show table counts before reset
SELECT 
    (SELECT count(*) FROM accounts WHERE user_id = 'ab12a3f3-75ef-4822-a1b3-7994c546deb1') as accounts,
    (SELECT count(*) FROM transactions WHERE user_id = 'ab12a3f3-75ef-4822-a1b3-7994c546deb1') as transactions,
    (SELECT count(*) FROM ledger_logs WHERE user_id = 'ab12a3f3-75ef-4822-a1b3-7994c546deb1') as ledger_logs;

-- 4. Execute reset_user_data
SELECT reset_user_data('ab12a3f3-75ef-4822-a1b3-7994c546deb1');

-- 5. Show table counts after reset
SELECT 
    (SELECT count(*) FROM accounts WHERE user_id = 'ab12a3f3-75ef-4822-a1b3-7994c546deb1') as accounts,
    (SELECT count(*) FROM transactions WHERE user_id = 'ab12a3f3-75ef-4822-a1b3-7994c546deb1') as transactions,
    (SELECT count(*) FROM ledger_logs WHERE user_id = 'ab12a3f3-75ef-4822-a1b3-7994c546deb1') as ledger_logs;

ROLLBACK;
