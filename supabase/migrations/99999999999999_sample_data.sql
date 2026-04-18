-- Sample Data Migration for Testing
-- This migration inserts sample data for all tables
-- WARNING: This is for development/testing only. Remove in production!

-- Note: Replace 'YOUR_USER_ID_HERE' with your actual user ID from auth.users
-- You can get your user ID by running: SELECT id FROM auth.users WHERE email = 'your-email@example.com';

DO $$
DECLARE
    v_user_id UUID;
    v_checking_account UUID;
    v_savings_account UUID;
    v_credit_account UUID;
    v_investment_account UUID;
    v_recipient1_id UUID;
    v_recipient2_id UUID;
    v_goal1_id UUID;
    v_goal2_id UUID;
BEGIN
    -- Get the first user from auth.users (or create a test user)
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    -- If no user exists, you need to sign up first through the app
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'No user found. Please sign up through the app first, then run this migration.';
        RETURN;
    END IF;

    RAISE NOTICE 'Using user ID: %', v_user_id;

    -- ============================================
    -- 1. ACCOUNTS
    -- ============================================
    
    -- Checking Account
    INSERT INTO public.accounts (id, user_id, name, type, balance, currency)
    VALUES (gen_random_uuid(), v_user_id, 'HDFC Checking', 'checking', 125000.00, 'INR')
    RETURNING id INTO v_checking_account;

    -- Savings Account
    INSERT INTO public.accounts (id, user_id, name, type, balance, currency)
    VALUES (gen_random_uuid(), v_user_id, 'SBI Savings', 'savings', 350000.00, 'INR')
    RETURNING id INTO v_savings_account;

    -- Credit Card
    INSERT INTO public.accounts (id, user_id, name, type, balance, currency)
    VALUES (gen_random_uuid(), v_user_id, 'ICICI Credit Card', 'credit', -15000.00, 'INR')
    RETURNING id INTO v_credit_account;

    -- Investment Account
    INSERT INTO public.accounts (id, user_id, name, type, balance, currency)
    VALUES (gen_random_uuid(), v_user_id, 'Zerodha Trading', 'investment', 500000.00, 'INR')
    RETURNING id INTO v_investment_account;

    RAISE NOTICE 'Created 4 accounts';

    -- ============================================
    -- 2. TRANSACTIONS (Income & Expenses)
    -- ============================================
    
    -- Income Transactions
    INSERT INTO public.transactions (user_id, account_id, description, amount, type, category, date)
    VALUES 
        (v_user_id, v_checking_account, 'Monthly Salary', 85000.00, 'income', 'Salary', CURRENT_DATE - INTERVAL '5 days'),
        (v_user_id, v_savings_account, 'Freelance Project', 25000.00, 'income', 'Freelance', CURRENT_DATE - INTERVAL '10 days'),
        (v_user_id, v_checking_account, 'Bonus', 15000.00, 'income', 'Bonus', CURRENT_DATE - INTERVAL '15 days'),
        (v_user_id, v_savings_account, 'Interest Credit', 450.00, 'income', 'Interest', CURRENT_DATE - INTERVAL '20 days');

    -- Expense Transactions
    INSERT INTO public.transactions (user_id, account_id, description, amount, type, category, date)
    VALUES 
        (v_user_id, v_checking_account, 'Rent Payment', -25000.00, 'expense', 'Housing', CURRENT_DATE - INTERVAL '3 days'),
        (v_user_id, v_credit_account, 'Grocery Shopping', -5500.00, 'expense', 'Food', CURRENT_DATE - INTERVAL '2 days'),
        (v_user_id, v_checking_account, 'Electricity Bill', -2800.00, 'expense', 'Utilities', CURRENT_DATE - INTERVAL '4 days'),
        (v_user_id, v_credit_account, 'Restaurant Dinner', -3200.00, 'expense', 'Food', CURRENT_DATE - INTERVAL '1 day'),
        (v_user_id, v_checking_account, 'Uber Rides', -850.00, 'expense', 'Transportation', CURRENT_DATE - INTERVAL '2 days'),
        (v_user_id, v_credit_account, 'Netflix Subscription', -799.00, 'expense', 'Entertainment', CURRENT_DATE - INTERVAL '7 days'),
        (v_user_id, v_checking_account, 'Gym Membership', -1500.00, 'expense', 'Health', CURRENT_DATE - INTERVAL '8 days'),
        (v_user_id, v_credit_account, 'Amazon Shopping', -4500.00, 'expense', 'Shopping', CURRENT_DATE - INTERVAL '5 days'),
        (v_user_id, v_checking_account, 'Mobile Recharge', -599.00, 'expense', 'Utilities', CURRENT_DATE - INTERVAL '6 days'),
        (v_user_id, v_credit_account, 'Movie Tickets', -800.00, 'expense', 'Entertainment', CURRENT_DATE - INTERVAL '9 days');

    RAISE NOTICE 'Created 14 transactions';

    -- ============================================
    -- 3. TRANSFERS
    -- ============================================
    
    INSERT INTO public.transfers (user_id, from_account_id, to_account_id, amount, note)
    VALUES 
        (v_user_id, v_checking_account, v_savings_account, 20000.00, 'Monthly savings transfer'),
        (v_user_id, v_savings_account, v_investment_account, 50000.00, 'Investment fund transfer'),
        (v_user_id, v_checking_account, v_credit_account, 15000.00, 'Credit card payment');

    RAISE NOTICE 'Created 3 transfers';

    -- ============================================
    -- 4. RECIPIENTS (Family/Friends)
    -- ============================================
    
    INSERT INTO public.recipients (id, user_id, name, relationship, account_number, bank_name)
    VALUES 
        (gen_random_uuid(), v_user_id, 'Rajesh Kumar', 'Family', '1234567890', 'HDFC Bank')
        RETURNING id INTO v_recipient1_id;

    INSERT INTO public.recipients (id, user_id, name, relationship, account_number, bank_name)
    VALUES 
        (gen_random_uuid(), v_user_id, 'Priya Sharma', 'Friend', '9876543210', 'SBI')
        RETURNING id INTO v_recipient2_id;

    INSERT INTO public.recipients (user_id, name, relationship, account_number, bank_name)
    VALUES 
        (v_user_id, 'Amit Patel', 'Family', '5555666677', 'ICICI Bank'),
        (v_user_id, 'Sneha Reddy', 'Friend', '4444333322', 'Axis Bank');

    RAISE NOTICE 'Created 4 recipients';

    -- ============================================
    -- 5. GOALS
    -- ============================================
    
    INSERT INTO public.goals (id, user_id, name, target_amount, current_amount, deadline, category)
    VALUES 
        (gen_random_uuid(), v_user_id, 'Emergency Fund', 500000.00, 150000.00, CURRENT_DATE + INTERVAL '12 months', 'Savings')
        RETURNING id INTO v_goal1_id;

    INSERT INTO public.goals (id, user_id, name, target_amount, current_amount, deadline, category)
    VALUES 
        (gen_random_uuid(), v_user_id, 'New Car', 800000.00, 200000.00, CURRENT_DATE + INTERVAL '18 months', 'Purchase')
        RETURNING id INTO v_goal2_id;

    INSERT INTO public.goals (user_id, name, target_amount, current_amount, deadline, category)
    VALUES 
        (v_user_id, 'Vacation to Europe', 300000.00, 75000.00, CURRENT_DATE + INTERVAL '8 months', 'Travel'),
        (v_user_id, 'Home Down Payment', 2000000.00, 500000.00, CURRENT_DATE + INTERVAL '24 months', 'Property');

    RAISE NOTICE 'Created 4 goals';

    -- ============================================
    -- 6. INVESTMENTS (Stocks)
    -- ============================================
    
    INSERT INTO public.investments (user_id, name, type, symbol, quantity, buy_price, current_price, currency, bought_at)
    VALUES 
        (v_user_id, 'Reliance Industries', 'stock', 'RELIANCE', 50, 2450.00, 2580.00, 'INR', CURRENT_DATE - INTERVAL '60 days'),
        (v_user_id, 'Tata Consultancy Services', 'stock', 'TCS', 30, 3200.00, 3450.00, 'INR', CURRENT_DATE - INTERVAL '90 days'),
        (v_user_id, 'HDFC Bank', 'stock', 'HDFCBANK', 40, 1550.00, 1620.00, 'INR', CURRENT_DATE - INTERVAL '45 days'),
        (v_user_id, 'Infosys', 'stock', 'INFY', 60, 1420.00, 1480.00, 'INR', CURRENT_DATE - INTERVAL '75 days'),
        (v_user_id, 'ITC Limited', 'stock', 'ITC', 100, 385.00, 410.00, 'INR', CURRENT_DATE - INTERVAL '30 days');

    RAISE NOTICE 'Created 5 stock investments';

    -- ============================================
    -- 7. MUTUAL FUNDS
    -- ============================================
    
    INSERT INTO public.mutual_funds (user_id, fund_name, fund_symbol, units, avg_nav, current_nav, investment_type, category, amc_name)
    VALUES 
        (v_user_id, 'SBI Bluechip Fund', 'INF200K01VX8', 500.00, 65.50, 68.20, 'SIP', 'Equity', 'SBI Mutual Fund'),
        (v_user_id, 'HDFC Mid-Cap Opportunities', 'INF179K01VY6', 300.00, 125.00, 132.50, 'SIP', 'Equity', 'HDFC Mutual Fund'),
        (v_user_id, 'ICICI Prudential Balanced Advantage', 'INF109K01VZ4', 400.00, 48.75, 51.20, 'LUMPSUM', 'Hybrid', 'ICICI Prudential'),
        (v_user_id, 'Axis Long Term Equity Fund', 'INF846K01VW2', 250.00, 85.00, 89.50, 'SIP', 'Equity', 'Axis Mutual Fund');

    RAISE NOTICE 'Created 4 mutual fund holdings';

    -- ============================================
    -- 8. MUTUAL FUND TRADES
    -- ============================================
    
    INSERT INTO public.mutual_fund_trades (user_id, mf_id, fund_name, trade_type, units, nav, amount, date)
    SELECT 
        v_user_id,
        mf.id,
        mf.fund_name,
        'BUY',
        100.00,
        mf.avg_nav,
        100.00 * mf.avg_nav,
        CURRENT_DATE - INTERVAL '30 days'
    FROM public.mutual_funds mf
    WHERE mf.user_id = v_user_id
    LIMIT 2;

    RAISE NOTICE 'Created mutual fund trade history';

    -- ============================================
    -- 9. LEDGER LOGS
    -- ============================================
    
    INSERT INTO public.ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
    VALUES 
        (v_user_id, v_checking_account, 'HDFC Checking', 'CREATE', 125000.00, 0, 125000.00, 'Account created with initial balance'),
        (v_user_id, v_savings_account, 'SBI Savings', 'CREATE', 350000.00, 0, 350000.00, 'Account created with initial balance'),
        (v_user_id, v_checking_account, 'HDFC Checking', 'TRANSFER_OUT', 20000.00, 125000.00, 105000.00, 'Transfer to SBI Savings'),
        (v_user_id, v_savings_account, 'SBI Savings', 'TRANSFER_IN', 20000.00, 350000.00, 370000.00, 'Transfer from HDFC Checking');

    RAISE NOTICE 'Created ledger logs';

    -- ============================================
    -- SUMMARY
    -- ============================================
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Sample data inserted successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE 'Accounts: 4 (Checking, Savings, Credit, Investment)';
    RAISE NOTICE 'Transactions: 14 (4 income, 10 expenses)';
    RAISE NOTICE 'Transfers: 3';
    RAISE NOTICE 'Recipients: 4';
    RAISE NOTICE 'Goals: 4';
    RAISE NOTICE 'Stocks: 5';
    RAISE NOTICE 'Mutual Funds: 4';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'You can now test all features in your app!';
    RAISE NOTICE '========================================';

END $$;
