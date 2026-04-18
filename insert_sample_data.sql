-- Quick Sample Data Insert Script
-- Run this in your Supabase SQL Editor after signing up

-- This script will insert sample data for the currently authenticated user
-- Make sure you're signed up in the app first!

DO $$
DECLARE
    v_user_id UUID;
    v_checking UUID;
    v_savings UUID;
    v_credit UUID;
    v_investment UUID;
BEGIN
    -- Get your user ID (replace with your actual user ID or email)
    -- Option 1: Get first user
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    -- Option 2: Get by email (uncomment and replace email)
    -- SELECT id INTO v_user_id FROM auth.users WHERE email = 'your-email@example.com';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No user found. Please sign up first!';
    END IF;

    -- Create Accounts
    INSERT INTO accounts (user_id, name, type, balance) VALUES
        (v_user_id, 'HDFC Checking', 'checking', 125000.00),
        (v_user_id, 'SBI Savings', 'savings', 350000.00),
        (v_user_id, 'ICICI Credit Card', 'credit', -15000.00),
        (v_user_id, 'Zerodha Trading', 'investment', 500000.00)
    RETURNING id INTO v_checking;
    
    SELECT id INTO v_checking FROM accounts WHERE user_id = v_user_id AND name = 'HDFC Checking';
    SELECT id INTO v_savings FROM accounts WHERE user_id = v_user_id AND name = 'SBI Savings';
    SELECT id INTO v_credit FROM accounts WHERE user_id = v_user_id AND name = 'ICICI Credit Card';
    SELECT id INTO v_investment FROM accounts WHERE user_id = v_user_id AND name = 'Zerodha Trading';

    -- Income Transactions
    INSERT INTO transactions (user_id, account_id, description, amount, type, category, date) VALUES
        (v_user_id, v_checking, 'Monthly Salary', 85000.00, 'income', 'Salary', CURRENT_DATE - 5),
        (v_user_id, v_savings, 'Freelance Project', 25000.00, 'income', 'Freelance', CURRENT_DATE - 10),
        (v_user_id, v_checking, 'Bonus', 15000.00, 'income', 'Bonus', CURRENT_DATE - 15),
        (v_user_id, v_savings, 'Interest Credit', 450.00, 'income', 'Interest', CURRENT_DATE - 20);

    -- Expense Transactions
    INSERT INTO transactions (user_id, account_id, description, amount, type, category, date) VALUES
        (v_user_id, v_checking, 'Rent Payment', -25000.00, 'expense', 'Housing', CURRENT_DATE - 3),
        (v_user_id, v_credit, 'Grocery Shopping', -5500.00, 'expense', 'Food', CURRENT_DATE - 2),
        (v_user_id, v_checking, 'Electricity Bill', -2800.00, 'expense', 'Utilities', CURRENT_DATE - 4),
        (v_user_id, v_credit, 'Restaurant Dinner', -3200.00, 'expense', 'Food', CURRENT_DATE - 1),
        (v_user_id, v_checking, 'Uber Rides', -850.00, 'expense', 'Transportation', CURRENT_DATE - 2),
        (v_user_id, v_credit, 'Netflix Subscription', -799.00, 'expense', 'Entertainment', CURRENT_DATE - 7),
        (v_user_id, v_checking, 'Gym Membership', -1500.00, 'expense', 'Health', CURRENT_DATE - 8),
        (v_user_id, v_credit, 'Amazon Shopping', -4500.00, 'expense', 'Shopping', CURRENT_DATE - 5);

    -- Transfers
    INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, note) VALUES
        (v_user_id, v_checking, v_savings, 20000.00, 'Monthly savings'),
        (v_user_id, v_savings, v_investment, 50000.00, 'Investment fund'),
        (v_user_id, v_checking, v_credit, 15000.00, 'Credit card payment');

    -- Recipients
    INSERT INTO recipients (user_id, name, relationship, account_number, bank_name) VALUES
        (v_user_id, 'Rajesh Kumar', 'Family', '1234567890', 'HDFC Bank'),
        (v_user_id, 'Priya Sharma', 'Friend', '9876543210', 'SBI'),
        (v_user_id, 'Amit Patel', 'Family', '5555666677', 'ICICI Bank');

    -- Goals
    INSERT INTO goals (user_id, name, target_amount, current_amount, deadline, category) VALUES
        (v_user_id, 'Emergency Fund', 500000, 150000, CURRENT_DATE + 365, 'Savings'),
        (v_user_id, 'New Car', 800000, 200000, CURRENT_DATE + 540, 'Purchase'),
        (v_user_id, 'Europe Vacation', 300000, 75000, CURRENT_DATE + 240, 'Travel');

    -- Stocks
    INSERT INTO investments (user_id, name, type, symbol, quantity, buy_price, current_price, bought_at) VALUES
        (v_user_id, 'Reliance Industries', 'stock', 'RELIANCE', 50, 2450.00, 2580.00, CURRENT_DATE - 60),
        (v_user_id, 'TCS', 'stock', 'TCS', 30, 3200.00, 3450.00, CURRENT_DATE - 90),
        (v_user_id, 'HDFC Bank', 'stock', 'HDFCBANK', 40, 1550.00, 1620.00, CURRENT_DATE - 45),
        (v_user_id, 'Infosys', 'stock', 'INFY', 60, 1420.00, 1480.00, CURRENT_DATE - 75);

    -- Mutual Funds
    INSERT INTO mutual_funds (user_id, fund_name, fund_symbol, units, avg_nav, current_nav, investment_type, category, amc_name) VALUES
        (v_user_id, 'SBI Bluechip Fund', 'INF200K01VX8', 500, 65.50, 68.20, 'SIP', 'Equity', 'SBI Mutual Fund'),
        (v_user_id, 'HDFC Mid-Cap', 'INF179K01VY6', 300, 125.00, 132.50, 'SIP', 'Equity', 'HDFC Mutual Fund'),
        (v_user_id, 'ICICI Balanced', 'INF109K01VZ4', 400, 48.75, 51.20, 'LUMPSUM', 'Hybrid', 'ICICI Prudential');

    RAISE NOTICE 'Sample data inserted successfully for user: %', v_user_id;
END $$;
