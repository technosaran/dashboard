-- FinanceOS Database Comprehensive Seed Script (All Sections, High Volume)
-- This script replaces existing user data with a massive set of realistic demo data across all modules for ALL users.

DO $$
DECLARE
    v_user_id UUID;
    
    -- Variables for UUIDs
    v_acc_hdfc UUID;
    v_acc_icici UUID;
    v_acc_sbi UUID;
    v_acc_chase UUID;
    v_acc_crypto UUID;
    
    v_fx_exness UUID;
    v_fx_octa UUID;
    
    v_fam_sarah UUID;
    v_fam_john UUID;
    
    v_stk_rel UUID;
    v_stk_tcs UUID;
    v_stk_aapl UUID;
    v_stk_tsla UUID;
    
    v_mf_sbi UUID;
    v_mf_mirae UUID;
    v_mf_axis UUID;
    
    v_cry_btc UUID;
    v_cry_eth UUID;
    v_cry_sol UUID;
    
    v_bnd_nhai UUID;
    v_bnd_sbi UUID;
    
    v_alt_gold UUID;
    v_alt_re UUID;
    
    v_goal_car UUID;
    v_goal_house UUID;
    v_goal_vacation UUID;
    
    v_liab_edu UUID;
    v_liab_home UUID;
    
    v_date TIMESTAMP;
    i INTEGER;
BEGIN
    FOR v_user_id IN SELECT id FROM auth.users LOOP
        RAISE NOTICE 'Seeding data for user %', v_user_id;

        -- 1. Initialize fresh UUIDs for this user
        v_acc_hdfc := gen_random_uuid();
        v_acc_icici := gen_random_uuid();
        v_acc_sbi := gen_random_uuid();
        v_acc_chase := gen_random_uuid();
        v_acc_crypto := gen_random_uuid();
        v_fx_exness := gen_random_uuid();
        v_fx_octa := gen_random_uuid();
        v_fam_sarah := gen_random_uuid();
        v_fam_john := gen_random_uuid();
        v_stk_rel := gen_random_uuid();
        v_stk_tcs := gen_random_uuid();
        v_stk_aapl := gen_random_uuid();
        v_stk_tsla := gen_random_uuid();
        v_mf_sbi := gen_random_uuid();
        v_mf_mirae := gen_random_uuid();
        v_mf_axis := gen_random_uuid();
        v_cry_btc := gen_random_uuid();
        v_cry_eth := gen_random_uuid();
        v_cry_sol := gen_random_uuid();
        v_bnd_nhai := gen_random_uuid();
        v_bnd_sbi := gen_random_uuid();
        v_alt_gold := gen_random_uuid();
        v_alt_re := gen_random_uuid();
        v_goal_car := gen_random_uuid();
        v_goal_house := gen_random_uuid();
        v_goal_vacation := gen_random_uuid();
        v_liab_edu := gen_random_uuid();
        v_liab_home := gen_random_uuid();

        -- 2. Clean existing data
        DELETE FROM public.ledger_logs WHERE user_id = v_user_id;
        DELETE FROM public.transactions WHERE user_id = v_user_id;
        DELETE FROM public.transfers WHERE user_id = v_user_id;
        DELETE FROM public.incomes WHERE user_id = v_user_id;
        DELETE FROM public.expenses WHERE user_id = v_user_id;
        DELETE FROM public.stock_trades WHERE user_id = v_user_id;
        DELETE FROM public.investments WHERE user_id = v_user_id;
        DELETE FROM public.mutual_fund_trades WHERE user_id = v_user_id;
        DELETE FROM public.mutual_funds WHERE user_id = v_user_id;
        DELETE FROM public.bond_transactions WHERE user_id = v_user_id;
        DELETE FROM public.bonds WHERE user_id = v_user_id;
        DELETE FROM public.alternative_assets WHERE user_id = v_user_id;
        DELETE FROM public.liabilities WHERE user_id = v_user_id;
        DELETE FROM public.forex_transactions WHERE user_id = v_user_id;
        DELETE FROM public.forex_trades WHERE user_id = v_user_id;
        DELETE FROM public.forex_accounts WHERE user_id = v_user_id;
        DELETE FROM public.fno_trades WHERE user_id = v_user_id;
        DELETE FROM public.budgets WHERE user_id = v_user_id;
        DELETE FROM public.goals WHERE user_id = v_user_id;
        DELETE FROM public.family_transfers WHERE user_id = v_user_id;
        DELETE FROM public.family_allowances WHERE user_id = v_user_id;
        DELETE FROM public.family_members WHERE user_id = v_user_id;
        DELETE FROM public.accounts WHERE user_id = v_user_id;

        -- 3. ACCOUNTS
        INSERT INTO public.accounts (id, user_id, name, type, balance, currency, bank_name, color) VALUES 
            (v_acc_hdfc, v_user_id, 'HDFC Salary', 'savings', 850000.00, 'INR', 'HDFC Bank', '#1e40af'),
            (v_acc_icici, v_user_id, 'ICICI Credit', 'credit', -45000.00, 'INR', 'ICICI Bank', '#ea580c'),
            (v_acc_sbi, v_user_id, 'SBI Savings', 'savings', 1200000.00, 'INR', 'SBI', '#0284c7'),
            (v_acc_chase, v_user_id, 'Chase Checking', 'checking', 25000.00, 'USD', 'Chase Bank', '#0ea5e9'),
            (v_acc_crypto, v_user_id, 'Binance Wallet', 'investment', 15000.00, 'USD', 'Binance', '#8b5cf6');

        -- 4. FAMILY
        INSERT INTO public.family_members (id, user_id, name, relationship, balance) VALUES 
            (v_fam_sarah, v_user_id, 'Sarah', 'Spouse', 25000.00),
            (v_fam_john, v_user_id, 'John Jr.', 'Child', 5000.00);

        INSERT INTO public.family_allowances (user_id, family_member_id, amount, frequency, last_paid_at) VALUES 
            (v_user_id, v_fam_sarah, 20000, 'Monthly', CURRENT_DATE - '5 days'::interval),
            (v_user_id, v_fam_john, 5000, 'Monthly', CURRENT_DATE - '2 days'::interval);

        -- 5. CASH FLOW (12 months of high volume data)
        FOR i IN 0..11 LOOP
            v_date := '2025-07-01'::TIMESTAMP + (i || ' month')::INTERVAL;
            
            -- Salary
            INSERT INTO public.incomes (id, user_id, account_id, amount, category, description, date) 
                VALUES (gen_random_uuid(), v_user_id, v_acc_hdfc, 180000, 'Salary', 'Monthly Tech Salary', v_date);
            INSERT INTO public.transactions (user_id, account_id, description, amount, type, category, date) 
                VALUES (v_user_id, v_acc_hdfc, 'Salary Deposit', 180000, 'income', 'Salary', v_date);
                
            -- Freelance USD
            INSERT INTO public.incomes (id, user_id, account_id, amount, category, description, date) 
                VALUES (gen_random_uuid(), v_user_id, v_acc_chase, 3500, 'Freelance', 'Upwork Project', v_date + '15 days'::interval);
            INSERT INTO public.transactions (user_id, account_id, description, amount, type, category, date) 
                VALUES (v_user_id, v_acc_chase, 'Upwork Transfer', 3500, 'income', 'Freelance', v_date + '15 days'::interval);

            -- Expenses
            INSERT INTO public.expenses (id, user_id, account_id, amount, category, description, date) 
                VALUES (gen_random_uuid(), v_user_id, v_acc_hdfc, 45000, 'Housing', 'Apartment Rent', v_date + '2 days'::interval),
                       (gen_random_uuid(), v_user_id, v_acc_icici, 12000, 'Food', 'Groceries', v_date + '10 days'::interval),
                       (gen_random_uuid(), v_user_id, v_acc_icici, 8500, 'Transport', 'Fuel & Cab', v_date + '14 days'::interval),
                       (gen_random_uuid(), v_user_id, v_acc_chase, 120, 'Software', 'AWS Bill', v_date + '18 days'::interval);
                       
            INSERT INTO public.transactions (user_id, account_id, description, amount, type, category, date) 
                VALUES (v_user_id, v_acc_hdfc, 'Rent Payment', 45000, 'expense', 'Housing', v_date + '2 days'::interval),
                       (v_user_id, v_acc_icici, 'Supermarket', 12000, 'expense', 'Food', v_date + '10 days'::interval),
                       (v_user_id, v_acc_icici, 'Fuel Station', 8500, 'expense', 'Transport', v_date + '14 days'::interval),
                       (v_user_id, v_acc_chase, 'Amazon Web Services', 120, 'expense', 'Software', v_date + '18 days'::interval);
                       
            -- Family Transfer
            INSERT INTO public.family_transfers (user_id, family_member_id, account_id, amount, type, transfer_date, note) VALUES
                (v_user_id, v_fam_sarah, v_acc_hdfc, 20000, 'ALLOWANCE', v_date + '5 days'::interval, 'Monthly Allowance');
        END LOOP;

        -- 6. BUDGETS
        INSERT INTO public.budgets (user_id, category, amount, period_month, period_year) VALUES 
            (v_user_id, 'Housing', 45000, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE)),
            (v_user_id, 'Food', 15000, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE)),
            (v_user_id, 'Transport', 10000, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE)),
            (v_user_id, 'Shopping', 20000, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE));

        -- 7. STOCKS (INR & USD)
        INSERT INTO public.investments (id, user_id, symbol, name, quantity, buy_price, current_price, currency, type) VALUES 
            (v_stk_rel, v_user_id, 'RELIANCE.NS', 'Reliance Ind', 100, 2400.00, 2910.50, 'INR', 'stock'),
            (v_stk_tcs, v_user_id, 'TCS.NS', 'TCS Ltd', 50, 3400.00, 3950.00, 'INR', 'stock'),
            (v_stk_aapl, v_user_id, 'AAPL', 'Apple Inc', 40, 160.00, 185.00, 'USD', 'stock'),
            (v_stk_tsla, v_user_id, 'TSLA', 'Tesla Inc', 25, 180.00, 175.00, 'USD', 'stock');

        INSERT INTO public.stock_trades (id, user_id, investment_id, symbol, trade_type, quantity, price, total_amount, trade_date) VALUES
            (gen_random_uuid(), v_user_id, v_stk_rel, 'RELIANCE.NS', 'buy', 50, 2400.00, 120000, '2025-08-15'),
            (gen_random_uuid(), v_user_id, v_stk_rel, 'RELIANCE.NS', 'buy', 50, 2450.00, 122500, '2025-10-10'),
            (gen_random_uuid(), v_user_id, v_stk_tcs, 'TCS.NS', 'buy', 50, 3400.00, 170000, '2025-09-01'),
            (gen_random_uuid(), v_user_id, v_stk_aapl, 'AAPL', 'buy', 40, 160.00, 6400, '2025-07-20'),
            (gen_random_uuid(), v_user_id, v_stk_tsla, 'TSLA', 'buy', 25, 180.00, 4500, '2025-11-15');

        -- 8. MUTUAL FUNDS
        INSERT INTO public.mutual_funds (id, user_id, fund_name, fund_symbol, units, avg_nav, current_nav, category) VALUES 
            (v_mf_sbi, v_user_id, 'SBI Bluechip', '103504', 1500, 60.00, 85.50, 'Large Cap'),
            (v_mf_mirae, v_user_id, 'Mirae Asset Emerging', '112093', 2000, 110.00, 132.40, 'Mid Cap'),
            (v_mf_axis, v_user_id, 'Axis Small Cap', '120503', 1000, 45.00, 65.00, 'Small Cap');

        INSERT INTO public.mutual_fund_trades (user_id, account_id, mf_id, fund_name, trade_type, units, nav, amount, date) VALUES
            (v_user_id, v_acc_hdfc, v_mf_sbi, 'SBI Bluechip', 'BUY', 1500, 60.00, 90000, '2025-07-10'),
            (v_user_id, v_acc_hdfc, v_mf_mirae, 'Mirae Asset Emerging', 'BUY', 2000, 110.00, 220000, '2025-08-10'),
            (v_user_id, v_acc_hdfc, v_mf_axis, 'Axis Small Cap', 'BUY', 1000, 45.00, 45000, '2025-09-10');

        -- 9. CRYPTO
        INSERT INTO public.investments (id, user_id, symbol, name, quantity, buy_price, current_price, currency, type) VALUES 
            (v_cry_btc, v_user_id, 'BTC', 'Bitcoin', 0.5, 40000.00, 65000.00, 'USD', 'crypto'),
            (v_cry_eth, v_user_id, 'ETH', 'Ethereum', 5.0, 2200.00, 3500.00, 'USD', 'crypto'),
            (v_cry_sol, v_user_id, 'SOL', 'Solana', 100.0, 90.00, 145.00, 'USD', 'crypto');

        -- 10. BONDS
        INSERT INTO public.bonds (id, user_id, bond_name, isin, issuer, bond_type, face_value, quantity, purchase_price, current_price, total_invested, current_value, coupon_rate, purchase_date, maturity_date, status) VALUES 
            (v_bnd_nhai, v_user_id, 'NHAI Tax Free', 'INE906B07ED2', 'NHAI', 'Government', 1000, 50, 1000.00, 1050.00, 50000, 52500, 8.20, '2025-01-10', '2035-01-10', 'Active'),
            (v_bnd_sbi, v_user_id, 'SBI Tier II', 'INE062A08298', 'SBI', 'Corporate', 10000, 10, 10000.00, 10200.00, 100000, 102000, 7.90, '2025-06-15', '2030-06-15', 'Active');

        INSERT INTO public.bond_transactions (user_id, account_id, bond_id, transaction_type, quantity, price_per_bond, amount, transaction_date) VALUES
            (v_user_id, v_acc_sbi, v_bnd_nhai, 'BUY', 50, 1000.00, 50000, '2025-01-10'),
            (v_user_id, v_acc_sbi, v_bnd_sbi, 'BUY', 10, 10000.00, 100000, '2025-06-15');

        -- 11. ALTERNATIVE ASSETS
        INSERT INTO public.alternative_assets (id, user_id, name, category, purchase_price, current_value, purchase_date) VALUES
            (v_alt_gold, v_user_id, 'Physical Gold (100g)', 'Commodities', 550000, 680000, '2024-05-15'),
            (v_alt_re, v_user_id, 'Commercial Plot - Pune', 'Real Estate', 2500000, 3200000, '2023-11-20');

        -- 12. FOREX ACCOUNTS & TRADES
        INSERT INTO public.forex_accounts (id, user_id, broker_name, account_label, balance, total_pnl, currency) VALUES
            (v_fx_exness, v_user_id, 'Exness', 'Main Scalping', 5500.00, 1500.00, 'USD'),
            (v_fx_octa, v_user_id, 'OctaFX', 'Swing Trading', 12000.00, -800.00, 'USD');

        INSERT INTO public.forex_trades (user_id, forex_account_id, pair, trade_type, lot_size, entry_price, exit_price, pnl, status) VALUES
            (v_user_id, v_fx_exness, 'EUR/USD', 'BUY', 1.0, 1.0850, 1.0890, 400.00, 'Closed'),
            (v_user_id, v_fx_exness, 'GBP/JPY', 'SELL', 0.5, 190.50, 189.50, 500.00, 'Closed'),
            (v_user_id, v_fx_octa, 'XAU/USD', 'BUY', 2.0, 2350.00, 2345.00, -1000.00, 'Closed'),
            (v_user_id, v_fx_exness, 'USD/JPY', 'BUY', 1.0, 155.20, NULL, 0, 'Open');

        -- 13. F&O TRADES (Futures & Options)
        INSERT INTO public.fno_trades (user_id, symbol, instrument_type, strike_price, expiry_date, trade_type, quantity, entry_price, exit_price, pnl, status) VALUES
            (v_user_id, 'NIFTY', 'CE', 22500, CURRENT_DATE + '7 days'::interval, 'BUY', 50, 150.00, 220.00, 3500.00, 'CLOSED'),
            (v_user_id, 'BANKNIFTY', 'PE', 48000, CURRENT_DATE + '7 days'::interval, 'SELL', 30, 300.00, 150.00, 4500.00, 'CLOSED'),
            (v_user_id, 'RELIANCE', 'FUT', NULL, CURRENT_DATE + '20 days'::interval, 'BUY', 250, 2900.00, NULL, NULL, 'OPEN');

        -- 14. GOALS
        INSERT INTO public.goals (id, user_id, name, target_amount, current_amount, deadline, category) VALUES 
            (v_goal_car, v_user_id, 'Tesla Model 3', 4500000, 1500000, '2027-12-31', 'Automobile'),
            (v_goal_house, v_user_id, 'Villa Downpayment', 10000000, 3500000, '2029-06-30', 'Real Estate'),
            (v_goal_vacation, v_user_id, 'Europe Tour 2026', 800000, 600000, '2026-10-15', 'Travel');

        -- 15. LIABILITIES
        INSERT INTO public.liabilities (id, user_id, name, category, total_amount, remaining_amount, interest_rate, monthly_payment, due_date) VALUES 
            (v_liab_edu, v_user_id, 'Masters Education Loan', 'Education', 1500000, 850000, 8.5, 25000, '2030-01-01'),
            (v_liab_home, v_user_id, 'Home Mortgage', 'Mortgage', 5000000, 4800000, 9.0, 45000, '2045-05-01');

        -- 16. LEDGER LOGS
        INSERT INTO public.ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details) VALUES
            (v_user_id, v_acc_hdfc, 'HDFC Salary', 'ADJUST_UP', 180000.00, 670000.00, 850000.00, 'Salary Credit'),
            (v_user_id, v_acc_chase, 'Chase Checking', 'ADJUST_UP', 3500.00, 21500.00, 25000.00, 'Upwork Transfer');

    END LOOP;
    
    RAISE NOTICE 'Massive comprehensive seeding successfully completed for all users!';
END;
$$;
