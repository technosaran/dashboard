-- Migration: Fix seed account type check constraint violation
-- Purpose: Change 'bank' to 'checking' in generate_sample_data to align with the accounts_type_check constraint.

CREATE OR REPLACE FUNCTION generate_sample_data() RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_acc_bank UUID := gen_random_uuid();
    v_acc_cash UUID := gen_random_uuid();
    v_bond_id UUID := gen_random_uuid();
    v_mf_id UUID := gen_random_uuid();
    v_forex_acc UUID := gen_random_uuid();
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN 
        RAISE EXCEPTION 'Unauthorized: Must be logged in'; 
    END IF;

    -- Clean up first just in case
    PERFORM reset_user_data(v_user_id);

    -- 1. Accounts (Hardened: changed 'bank' to 'checking' to avoid violating accounts_type_check constraint)
    INSERT INTO public.accounts (id, user_id, name, type, balance, currency, institution, color)
    VALUES 
        (v_acc_bank, v_user_id, 'Main Checking', 'checking', 15000.00, 'USD', 'Chase Bank', '#0ea5e9'),
        (v_acc_cash, v_user_id, 'Emergency Fund', 'savings', 50000.00, 'USD', 'Ally Bank', '#10b981');

    -- 2. Incomes
    INSERT INTO public.incomes (id, user_id, account_id, amount, category, description, date)
    VALUES 
        (gen_random_uuid(), v_user_id, v_acc_bank, 8500.00, 'Salary', 'Tech Corp Monthly Salary', current_date - interval '5 days'),
        (gen_random_uuid(), v_user_id, v_acc_bank, 1200.00, 'Freelance', 'UI Design Project', current_date - interval '15 days');

    -- 3. Expenses
    INSERT INTO public.expenses (id, user_id, account_id, amount, category, description, date)
    VALUES 
        (gen_random_uuid(), v_user_id, v_acc_bank, 2100.00, 'Housing', 'Monthly Rent', current_date - interval '4 days'),
        (gen_random_uuid(), v_user_id, v_acc_bank, 450.00, 'Food', 'Groceries', current_date - interval '2 days'),
        (gen_random_uuid(), v_user_id, v_acc_bank, 120.00, 'Utilities', 'Electric Bill', current_date - interval '10 days');

    -- 4. Budgets
    INSERT INTO public.budgets (id, user_id, category, amount, period_month, period_year)
    VALUES 
        (gen_random_uuid(), v_user_id, 'Housing', 2200.00, extract(month from current_date), extract(year from current_date)),
        (gen_random_uuid(), v_user_id, 'Food', 800.00, extract(month from current_date), extract(year from current_date)),
        (gen_random_uuid(), v_user_id, 'Utilities', 300.00, extract(month from current_date), extract(year from current_date));

    -- 5. Investments (Stocks)
    INSERT INTO public.investments (id, user_id, symbol, name, quantity, buy_price, current_price, currency, type)
    VALUES 
        (gen_random_uuid(), v_user_id, 'AAPL', 'Apple Inc.', 50, 150.00, 175.50, 'USD', 'stock'),
        (gen_random_uuid(), v_user_id, 'MSFT', 'Microsoft', 20, 310.00, 420.20, 'USD', 'stock'),
        (gen_random_uuid(), v_user_id, 'TSLA', 'Tesla', 15, 180.00, 195.00, 'USD', 'stock');

    -- 6. Mutual Funds
    INSERT INTO public.mutual_funds (id, user_id, fund_name, amc_name, units, avg_nav, current_nav)
    VALUES 
        (v_mf_id, v_user_id, 'Vanguard S&P 500 ETF', 'Vanguard', 120.5, 350.00, 410.25),
        (gen_random_uuid(), v_user_id, 'Fidelity Blue Chip', 'Fidelity', 450.2, 12.50, 14.80);

    -- 7. Bonds
    INSERT INTO public.bonds (id, user_id, bond_name, issuer, bond_type, isin, face_value, coupon_rate, purchase_price, current_price, quantity, total_invested, current_value, purchase_date, maturity_date)
    VALUES 
        (v_bond_id, v_user_id, 'US Treasury 10Y', 'US Govt', 'Government', 'US1234567890', 1000.00, 4.5, 950.00, 980.00, 10, 9500.00, 9800.00, current_date - interval '365 days', current_date + interval '3285 days');

    -- 8. Alternative Assets
    INSERT INTO public.alternative_assets (id, user_id, name, category, purchase_price, current_value, purchase_date)
    VALUES 
        (gen_random_uuid(), v_user_id, 'Physical Gold', 'Commodities', 25000.00, 28500.00, current_date - interval '2 years'),
        (gen_random_uuid(), v_user_id, 'Rolex Submariner', 'Collectibles', 12000.00, 14500.00, current_date - interval '1 year');

    -- 9. Liabilities
    INSERT INTO public.liabilities (id, user_id, name, category, total_amount, remaining_amount, interest_rate, monthly_payment)
    VALUES 
        (gen_random_uuid(), v_user_id, 'Car Loan', 'Vehicle', 35000.00, 22500.00, 5.5, 650.00),
        (gen_random_uuid(), v_user_id, 'Student Loan', 'Education', 45000.00, 41000.00, 4.2, 400.00);

    -- 10. Goals
    INSERT INTO public.goals (id, user_id, name, category, target_amount, current_amount, deadline)
    VALUES 
        (gen_random_uuid(), v_user_id, 'House Downpayment', 'Real Estate', 100000.00, 45000.00, current_date + interval '2 years'),
        (gen_random_uuid(), v_user_id, 'Europe Vacation', 'Travel', 15000.00, 15000.00, current_date + interval '3 months');

    -- 11. Net Worth Snapshots
    INSERT INTO public.net_worth_snapshots (id, user_id, snapshot_date, total_assets, total_liabilities, net_worth, accounts_balance, investments_value)
    VALUES 
        (gen_random_uuid(), v_user_id, current_date - interval '90 days', 150000, 70000, 80000, 40000, 110000),
        (gen_random_uuid(), v_user_id, current_date - interval '60 days', 165000, 68000, 97000, 45000, 120000),
        (gen_random_uuid(), v_user_id, current_date - interval '30 days', 180000, 65000, 115000, 55000, 125000),
        (gen_random_uuid(), v_user_id, current_date, 195000, 63500, 131500, 65000, 130000);

    RETURN json_build_object('success', true, 'message', 'Sample data generated successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
