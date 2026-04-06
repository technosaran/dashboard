-- Re-enable RLS on all tables for security
alter table accounts enable row level security;
alter table transactions enable row level security;
alter table transfers enable row level security;
alter table deposits enable row level security;

-- RLS policies for accounts (already exist from initial migration)
drop policy if exists "Users can manage their own accounts" on accounts;
create policy "Users can manage their own accounts"
  on accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS policies for transactions (already exist from initial migration)
drop policy if exists "Users can manage their own transactions" on transactions;
create policy "Users can manage their own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS policies for transfers
create policy "Users can manage their own transfers"
  on transfers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS policies for deposits
create policy "Users can manage their own deposits"
  on deposits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
