-- Drop foreign key constraints on user_id so a real auth user isn't required
-- This is temporary until auth is implemented
alter table accounts drop constraint if exists accounts_user_id_fkey;
alter table transactions drop constraint if exists transactions_user_id_fkey;
