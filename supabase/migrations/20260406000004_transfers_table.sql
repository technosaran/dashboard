create table if not exists transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  from_account_id uuid references accounts(id) on delete cascade not null,
  to_account_id uuid references accounts(id) on delete cascade not null,
  amount numeric(12, 2) not null,
  note text,
  created_at timestamptz not null default now()
);

alter table transfers disable row level security;
alter publication supabase_realtime add table transfers;
