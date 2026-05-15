DO $$
DECLARE
    v_user_id UUID;
    v_acc_chk UUID;
    v_acc_sav UUID;
    v_acc_csh UUID;
    v_acc_crd UUID;
    v_acc_brk UUID;
    
    v_rec_1 UUID;
    v_rec_2 UUID;
    
    v_fx_1 UUID;
    v_fx_2 UUID;
    
    v_bond_1 UUID;
    v_bond_2 UUID;
    v_bond_3 UUID;
    
    v_mf_1 UUID;
    v_mf_2 UUID;
    v_mf_3 UUID;
    v_mf_4 UUID;
    
    v_stk_1 UUID;
    v_stk_2 UUID;
    v_stk_3 UUID;
    v_stk_4 UUID;
    v_stk_5 UUID;
BEGIN
    FOR v_user_id IN SELECT id FROM auth.users LOOP
        -- Clean up first
        PERFORM reset_user_data(v_user_id);

        -- Initialize UUIDs
        v_acc_chk := gen_random_uuid(); v_acc_sav := gen_random_uuid(); v_acc_csh := gen_random_uuid(); v_acc_crd := gen_random_uuid(); v_acc_brk := gen_random_uuid();
        v_rec_1 := gen_random_uuid(); v_rec_2 := gen_random_uuid();
        v_fx_1 := gen_random_uuid(); v_fx_2 := gen_random_uuid();
        v_bond_1 := gen_random_uuid(); v_bond_2 := gen_random_uuid(); v_bond_3 := gen_random_uuid();
        v_mf_1 := gen_random_uuid(); v_mf_2 := gen_random_uuid(); v_mf_3 := gen_random_uuid(); v_mf_4 := gen_random_uuid();
        v_stk_1 := gen_random_uuid(); v_stk_2 := gen_random_uuid(); v_stk_3 := gen_random_uuid(); v_stk_4 := gen_random_uuid(); v_stk_5 := gen_random_uuid();

        -- ==========================================
        -- 1. ACCOUNTS
        -- ==========================================
        INSERT INTO public.accounts (id, user_id, name, type, balance, currency, institution, color) VALUES 
            (v_acc_chk, v_user_id, 'Primary Checking', 'checking', 18500.00, 'USD', 'Chase Bank', '#0ea5e9'),
            (v_acc_sav, v_user_id, 'High Yield Savings', 'savings', 75000.00, 'USD', 'Ally Bank', '#10b981'),
            (v_acc_csh, v_user_id, 'Wallet Cash', 'cash', 450.00, 'USD', 'Physical', '#f59e0b'),
            (v_acc_crd, v_user_id, 'Sapphire Reserve', 'credit', -2450.00, 'USD', 'Chase Bank', '#f43f5e'),
            (v_acc_brk, v_user_id, 'Brokerage', 'investment', 125000.00, 'USD', 'Charles Schwab', '#8b5cf6');

        -- ==========================================
        -- 2. TRANSACTIONS (General)
        -- ==========================================
        INSERT INTO public.transactions (account_id, user_id, description, amount, type, category, date) VALUES
            (v_acc_chk, v_user_id, 'Tech Corp Salary', 9200.00, 'income', 'Salary', current_date - interval '2 days'),
            (v_acc_chk, v_user_id, 'Tech Corp Salary', 9200.00, 'income', 'Salary', current_date - interval '32 days'),
            (v_acc_chk, v_user_id, 'Monthly Rent', 2400.00, 'expense', 'Housing', current_date - interval '1 day'),
            (v_acc_crd, v_user_id, 'Whole Foods Market', 420.00, 'expense', 'Food', current_date - interval '2 days'),
            (v_acc_crd, v_user_id, 'Netflix Subscription', 20.00, 'expense', 'Entertainment', current_date - interval '5 days'),
            (v_acc_crd, v_user_id, 'Gas Station', 65.00, 'expense', 'Transportation', current_date - interval '3 days'),
            (v_acc_sav, v_user_id, 'Ally Bank Interest', 350.00, 'income', 'Interest', current_date - interval '5 days');

        -- ==========================================
        -- 3. INCOMES & EXPENSES (Modules)
        -- ==========================================
        INSERT INTO public.incomes (id, user_id, account_id, amount, category, description, date) VALUES 
            (gen_random_uuid(), v_user_id, v_acc_chk, 9200.00, 'Salary', 'Tech Corp Monthly Salary', current_date - interval '2 days'),
            (gen_random_uuid(), v_user_id, v_acc_chk, 1500.00, 'Freelance', 'Design Project', current_date - interval '15 days');

        INSERT INTO public.expenses (id, user_id, account_id, amount, category, description, date, is_recurring) VALUES 
            (gen_random_uuid(), v_user_id, v_acc_chk, 2400.00, 'Housing', 'Monthly Rent', current_date - interval '1 days', true),
            (gen_random_uuid(), v_user_id, v_acc_crd, 180.00, 'Utilities', 'Electricity & Water', current_date - interval '5 days', true);

        -- ==========================================
        -- 4. BUDGETS
        -- ==========================================
        INSERT INTO public.budgets (id, user_id, category, amount, period_month, period_year) VALUES 
            (gen_random_uuid(), v_user_id, 'Housing', 2500.00, extract(month from current_date), extract(year from current_date)),
            (gen_random_uuid(), v_user_id, 'Food', 1000.00, extract(month from current_date), extract(year from current_date)),
            (gen_random_uuid(), v_user_id, 'Utilities', 400.00, extract(month from current_date), extract(year from current_date));

        -- ==========================================
        -- 5. STOCKS
        -- ==========================================
        INSERT INTO public.investments (id, user_id, symbol, name, quantity, buy_price, current_price, currency, type, day_change, day_change_percent, realized_pnl) VALUES 
            (v_stk_1, v_user_id, 'AAPL', 'Apple Inc.', 150, 145.00, 185.50, 'USD', 'stock', 2.50, 1.36, 450.00),
            (v_stk_2, v_user_id, 'MSFT', 'Microsoft Corp.', 80, 290.00, 415.20, 'USD', 'stock', -1.20, -0.28, 1200.00),
            (v_stk_3, v_user_id, 'NVDA', 'NVIDIA Corp.', 45, 420.00, 890.50, 'USD', 'stock', 15.40, 1.76, 5400.00);

        INSERT INTO public.stock_trades (id, user_id, investment_id, symbol, trade_type, quantity, price, total_amount, trade_date) VALUES
            (gen_random_uuid(), v_user_id, v_stk_1, 'AAPL', 'buy', 100, 140.00, 14000.00, current_date - interval '300 days'),
            (gen_random_uuid(), v_user_id, v_stk_1, 'AAPL', 'buy', 50, 155.00, 7750.00, current_date - interval '150 days'),
            (gen_random_uuid(), v_user_id, v_stk_1, 'AAPL', 'sell', 20, 180.00, 3600.00, current_date - interval '10 days');

        -- ==========================================
        -- 6. MUTUAL FUNDS
        -- ==========================================
        INSERT INTO public.mutual_funds (id, user_id, fund_name, amc_name, units, avg_nav, current_nav, day_change, day_change_percent) VALUES 
            (v_mf_1, v_user_id, 'Vanguard S&P 500 ETF', 'Vanguard', 350.5, 380.00, 425.50, 1.25, 0.29),
            (v_mf_2, v_user_id, 'Fidelity Blue Chip Growth', 'Fidelity', 1250.8, 14.20, 18.50, 0.12, 0.65);

        INSERT INTO public.mutual_fund_trades (id, user_id, account_id, mf_id, fund_name, trade_type, units, nav, amount, date) VALUES
            (gen_random_uuid(), v_user_id, v_acc_brk, v_mf_1, 'Vanguard S&P 500 ETF', 'BUY', 200.0, 370.00, 74000.00, current_date - interval '250 days');

        -- ==========================================
        -- 7. BONDS
        -- ==========================================
        INSERT INTO public.bonds (id, user_id, bond_name, issuer, bond_type, isin, face_value, coupon_rate, purchase_price, current_price, quantity, total_invested, current_value, purchase_date, maturity_date, total_interest_earned) VALUES 
            (v_bond_1, v_user_id, 'US Treasury 10Y', 'US Govt', 'Government', 'US1234567890', 1000.00, 4.25, 980.00, 995.00, 25, 24500.00, 24875.00, current_date - interval '400 days', current_date + interval '3250 days', 1062.50),
            (v_bond_2, v_user_id, 'Municipal Tax-Free', 'NY State', 'Tax-Free', 'US64966Q5E95', 5000.00, 3.10, 5000.00, 5050.00, 4, 20000.00, 20200.00, current_date - interval '100 days', current_date + interval '3500 days', 0.00);

        INSERT INTO public.bond_transactions (id, user_id, account_id, bond_id, transaction_type, quantity, price_per_bond, amount, transaction_date) VALUES
            (gen_random_uuid(), v_user_id, v_acc_brk, v_bond_1, 'BUY', 25, 980.00, 24500.00, current_date - interval '400 days');

        -- ==========================================
        -- 8. ALTERNATIVE ASSETS
        -- ==========================================
        INSERT INTO public.alternative_assets (id, user_id, name, category, purchase_price, current_value, purchase_date) VALUES 
            (gen_random_uuid(), v_user_id, 'Physical Gold Coins', 'Commodities', 15000.00, 18500.00, current_date - interval '3 years'),
            (gen_random_uuid(), v_user_id, 'Rolex Daytona', 'Collectibles', 14500.00, 22000.00, current_date - interval '2 years');

        -- ==========================================
        -- 9. LIABILITIES
        -- ==========================================
        INSERT INTO public.liabilities (id, user_id, name, category, total_amount, remaining_amount, interest_rate, monthly_payment, due_date) VALUES 
            (gen_random_uuid(), v_user_id, 'Mortgage', 'Real Estate', 450000.00, 385000.00, 3.2, 2400.00, '2050-01-01'),
            (gen_random_uuid(), v_user_id, 'Tesla Model 3 Loan', 'Vehicle', 45000.00, 28000.00, 4.5, 750.00, '2028-06-01');

        -- ==========================================
        -- 10. FOREX
        -- ==========================================
        INSERT INTO public.forex_accounts (id, user_id, broker_name, account_label, account_number, balance, currency, status) VALUES
            (v_fx_1, v_user_id, 'OANDA', 'OANDA Primary', 'OAN-88392', 25000.00, 'USD', 'Active');

        INSERT INTO public.forex_trades (id, user_id, forex_account_id, pair, trade_type, lot_size, entry_price, exit_price, pnl, status, trade_date, close_date) VALUES
            (gen_random_uuid(), v_user_id, v_fx_1, 'EUR/USD', 'BUY', 1.0, 1.0850, 1.0920, 700.00, 'Closed', current_date - interval '5 days', current_date - interval '4 days');

        -- ==========================================
        -- 11. GOALS
        -- ==========================================
        INSERT INTO public.goals (id, user_id, name, category, target_amount, current_amount, deadline) VALUES 
            (gen_random_uuid(), v_user_id, 'Beach House', 'Real Estate', 150000.00, 85000.00, current_date + interval '3 years');

        -- ==========================================
        -- 12. FAMILY (Recipients & Transfers)
        -- ==========================================
        INSERT INTO public.recipients (id, user_id, name, relationship) VALUES 
            (v_rec_1, v_user_id, 'Jane Doe', 'Family');

        INSERT INTO public.transactions (account_id, user_id, description, amount, type, category, date) VALUES
            (v_acc_chk, v_user_id, 'Sent money to Jane Doe: Household expenses', 1500.00, 'expense', 'Family & Friends', current_date - interval '5 days');

        -- ==========================================
        -- 13. INTERNAL TRANSFERS
        -- ==========================================
        INSERT INTO public.transfers (user_id, from_account_id, to_account_id, amount, note) VALUES
            (v_user_id, v_acc_chk, v_acc_sav, 5000.00, 'Moving to savings');

        -- ==========================================
        -- 14. LEDGER LOGS
        -- ==========================================
        INSERT INTO public.ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, created_at) VALUES
            (gen_random_uuid(), v_user_id, v_acc_chk, 'Primary Checking', 'ADJUST_UP', 9200.00, 9300.00, 18500.00, 'Salary deposit', current_date - interval '2 days');

        -- ==========================================
        -- 15. NET WORTH SNAPSHOTS
        -- ==========================================
        INSERT INTO public.net_worth_snapshots (id, user_id, snapshot_date, total_assets, total_liabilities, net_worth, accounts_balance, investments_value) VALUES 
            (gen_random_uuid(), v_user_id, current_date - interval '30 days', 480000, 460000, 20000, 105000, 375000),
            (gen_random_uuid(), v_user_id, current_date, 510000, 455000, 55000, 115000, 395000);

    END LOOP;
END;
$$;
