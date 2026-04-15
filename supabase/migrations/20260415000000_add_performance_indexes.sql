-- Optimization Indexes for Dashboard Loading Speed

-- Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);

-- Incomes
CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date DESC);

-- Ledger
CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON ledger_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_logs(created_at DESC);

-- Investments
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);

-- Mutual Funds
CREATE INDEX IF NOT EXISTS idx_mutual_funds_user_id ON mutual_funds(user_id);

-- Accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
