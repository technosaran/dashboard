-- Fix foreign key constraints referencing accounts to allow deletion
-- 1. Fix bond_transactions (allow setting account_id to null when the account is deleted)
ALTER TABLE bond_transactions 
  DROP CONSTRAINT IF EXISTS bond_transactions_account_id_fkey,
  ADD CONSTRAINT bond_transactions_account_id_fkey 
    FOREIGN KEY (account_id) 
    REFERENCES accounts(id) 
    ON DELETE SET NULL;

-- 2. Fix forex_transactions (allow setting bank_account_id to null when the bank account is deleted)
ALTER TABLE forex_transactions 
  DROP CONSTRAINT IF EXISTS forex_transactions_bank_account_id_fkey,
  ADD CONSTRAINT forex_transactions_bank_account_id_fkey 
    FOREIGN KEY (bank_account_id) 
    REFERENCES accounts(id) 
    ON DELETE SET NULL;
