-- Add indexes for better query performance
create index if not exists idx_accounts_user_id on accounts(user_id);
create index if not exists idx_transactions_user_id on transactions(user_id);
create index if not exists idx_transactions_account_id on transactions(account_id);
create index if not exists idx_transfers_user_id on transfers(user_id);
create index if not exists idx_transfers_from_account on transfers(from_account_id);
create index if not exists idx_transfers_to_account on transfers(to_account_id);
create index if not exists idx_deposits_user_id on deposits(user_id);
create index if not exists idx_deposits_account_id on deposits(account_id);

-- Add indexes for date-based queries
create index if not exists idx_transactions_date on transactions(date desc);
create index if not exists idx_transfers_created_at on transfers(created_at desc);
create index if not exists idx_deposits_created_at on deposits(created_at desc);
