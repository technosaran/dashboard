-- Add bank info to accounts
alter table accounts add column if not exists bank_name text;
alter table accounts add column if not exists bank_logo text;

-- Deposits log (money received)
create table if not exists deposits (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade not null,
  user_id uuid not null,
  amount numeric(12, 2) not null,
  note text,
  created_at timestamptz not null default now()
);

alter table deposits disable row level security;
alter publication supabase_realtime add table deposits;
