-- Accounts table
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit', 'investment')),
  balance numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

-- Transactions table
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  description text not null,
  amount numeric(12, 2) not null,
  type text not null check (type in ('income', 'expense')),
  category text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- RLS
alter table accounts enable row level security;
alter table transactions enable row level security;

create policy "Users can manage their own accounts"
  on accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
