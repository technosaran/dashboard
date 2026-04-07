-- Add 'cash' type to the accounts table type constraint
-- This allows the permanent Cash account to be created

-- Drop the old constraint
alter table accounts drop constraint if exists accounts_type_check;

-- Add new constraint with 'cash' type included
alter table accounts add constraint accounts_type_check 
  check (type in ('checking', 'savings', 'credit', 'investment', 'cash'));
