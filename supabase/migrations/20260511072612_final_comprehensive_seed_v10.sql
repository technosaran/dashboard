
-- Final Comprehensive Production Seeding (v16 - High Volume Data)
-- Coverage: 5-10 items per section for a rich dashboard experience
CREATE OR REPLACE FUNCTION seed_everything_v16(p_user_id UUID) RETURNS JSON AS $$
DECLARE
    v_acc_hdfc UUID;
    v_acc_icici UUID;
    v_acc_sbi UUID;
    v_acc_axis UUID;
    v_acc_cash UUID;
    v_acc_forex_1 UUID;
    v_acc_forex_2 UUID;
    v_bond_id UUID;
    v_stock_id UUID;
    v_mf_id UUID;
    v_goal_id UUID;
    v_recipient_id UUID;
BEGIN
    -- 1. Multiple Accounts
    INSERT INTO public.accounts (user_id, name, type, balance, currency, bank_name, color)
    VALUES (p_user_id, 'HDFC Privilege Savings', 'savings', 425000.00, 'INR', 'HDFC Bank', '#1e40af') RETURNING id INTO v_acc_hdfc;
    
    INSERT INTO public.accounts (user_id, name, type, balance, currency, bank_name, color)
    VALUES (p_user_id, 'ICICI Platinum Credit', 'credit', -12500.00, 'INR', 'ICICI Bank', '#ea580c') RETURNING id INTO v_acc_icici;

    INSERT INTO public.accounts (user_id, name, type, balance, currency, bank_name, color)
    VALUES (p_user_id, 'SBI Public Provident', 'savings', 1200000.00, 'INR', 'State Bank of India', '#0284c7') RETURNING id INTO v_acc_sbi;

    INSERT INTO public.accounts (user_id, name, type, balance, currency, bank_name, color)
    VALUES (p_user_id, 'Axis Wealth Account', 'investment', 850000.00, 'INR', 'Axis Bank', '#9d174d') RETURNING id INTO v_acc_axis;

    INSERT INTO public.accounts (user_id, name, type, balance, currency, color)
    VALUES (p_user_id, 'Emergency Cash', 'savings', 15000.00, 'INR', '#16a34a') RETURNING id INTO v_acc_cash;

    -- 2. Multiple Recipients
    INSERT INTO public.recipients (user_id, name, relationship) VALUES 
        (p_user_id, 'Sarah (Wife)', 'Family'),
        (p_user_id, 'John (Landlord)', 'Other'),
        (p_user_id, 'Michael (Brother)', 'Family'),
        (p_user_id, 'David (Business Partner)', 'Friend');

    -- 3. High Volume Incomes (Past 6 months)
    INSERT INTO public.incomes (user_id, amount, description, category, date, account_id) VALUES 
        (p_user_id, 145000.00, 'Executive Salary - Apr', 'Salary', '2026-04-01', v_acc_hdfc),
        (p_user_id, 145000.00, 'Executive Salary - Mar', 'Salary', '2026-03-01', v_acc_hdfc),
        (p_user_id, 25000.00, 'Quarterly Performance Bonus', 'Bonus', '2026-03-15', v_acc_hdfc),
        (p_user_id, 12000.00, 'Dividends - Reliance', 'Others', '2026-04-10', v_acc_axis),
        (p_user_id, 8500.00, 'Freelance Consulting', 'Work', '2026-04-20', v_acc_icici),
        (p_user_id, 5000.00, 'Referral Reward', 'Others', '2026-04-25', v_acc_cash);

    -- 4. High Volume Expenses
    INSERT INTO public.expenses (user_id, amount, description, category, date, account_id) VALUES 
        (p_user_id, 65000.00, 'Luxury Apartment Rent', 'Housing', CURRENT_DATE - 5, v_acc_hdfc),
        (p_user_id, 12400.00, 'Apple Store - iPhone Case', 'Shopping', CURRENT_DATE - 12, v_acc_icici),
        (p_user_id, 4500.00, 'Fuel - Shell Petrol', 'Transport', CURRENT_DATE - 2, v_acc_icici),
        (p_user_id, 3200.00, 'Fine Dining - Zuma', 'Food', CURRENT_DATE - 1, v_acc_hdfc),
        (p_user_id, 1500.00, 'Starbucks Coffee', 'Food', CURRENT_DATE - 3, v_acc_cash),
        (p_user_id, 8900.00, 'Electricity Bill', 'Utilities', CURRENT_DATE - 15, v_acc_hdfc),
        (p_user_id, 12000.00, 'Car Insurance', 'Insurance', CURRENT_DATE - 20, v_acc_axis);

    -- 5. Diverse Stock Portfolio
    INSERT INTO public.investments (user_id, name, type, symbol, quantity, buy_price, current_price) VALUES 
        (p_user_id, 'Reliance Industries', 'stock', 'RELIANCE.NS', 120, 2450.00, 2920.50),
        (p_user_id, 'HDFC Bank Ltd', 'stock', 'HDFCBANK.NS', 85, 1420.00, 1510.20),
        (p_user_id, 'Tata Consultancy Services', 'stock', 'TCS.NS', 25, 3200.00, 3950.00),
        (p_user_id, 'Infosys Ltd', 'stock', 'INFY.NS', 50, 1350.00, 1420.50),
        (p_user_id, 'Zomato Ltd', 'stock', 'ZOMATO.NS', 1000, 85.00, 195.00);

    -- 6. Diverse Mutual Funds
    INSERT INTO public.mutual_funds (user_id, fund_name, fund_symbol, units, avg_nav, current_nav, category) VALUES 
        (p_user_id, 'SBI Bluechip Fund', '103504', 450.25, 62.50, 85.40, 'Large Cap'),
        (p_user_id, 'Mirae Asset Large Cap', '112093', 820.12, 110.20, 125.80, 'Large Cap'),
        (p_user_id, 'Quant Small Cap Fund', '145235', 12500.00, 12.50, 32.10, 'Small Cap'),
        (p_user_id, 'Axis Midcap Fund', '118834', 650.00, 45.20, 58.90, 'Mid Cap');

    -- 7. Multiple Bonds
    INSERT INTO public.bonds (user_id, bond_name, isin, issuer, bond_type, face_value, quantity, purchase_price, current_price, total_invested, current_value, coupon_rate, ytm, purchase_date, maturity_date, status) VALUES 
        (p_user_id, 'NHAI Tax Free', 'INE906B07ED2', 'NHAI', 'Government', 1000, 25, 1120.00, 1150.00, 28000.00, 28750.00, 8.20, 7.10, '2023-01-01', '2033-01-01', 'Active'),
        (p_user_id, 'L&T Finance NCD', 'INE027E07982', 'L&T Finance', 'Corporate', 1000, 100, 1000.00, 1025.00, 100000.00, 102500.00, 9.10, 8.50, '2024-05-01', '2029-05-01', 'Active');

    -- 8. Multiple Forex Accounts & Active Trades
    INSERT INTO public.forex_accounts (user_id, broker_name, account_label, balance, currency, total_deposited)
    VALUES (p_user_id, 'Exness Global', 'Main Scalper', 5500.00, 'USD', 4000.00) RETURNING id INTO v_acc_forex_1;
    
    INSERT INTO public.forex_accounts (user_id, broker_name, account_label, balance, currency, total_deposited)
    VALUES (p_user_id, 'IC Markets', 'Swing Trade AC', 12000.00, 'USD', 10000.00) RETURNING id INTO v_acc_forex_2;

    INSERT INTO public.forex_trades (user_id, forex_account_id, pair, trade_type, lot_size, entry_price, exit_price, pnl, status, trade_date) VALUES 
        (p_user_id, v_acc_forex_1, 'EURUSD', 'BUY', 0.5, 1.0850, 1.0920, 350.00, 'Closed', CURRENT_DATE - 2),
        (p_user_id, v_acc_forex_1, 'GBPUSD', 'SELL', 0.2, 1.2650, 1.2610, 80.00, 'Closed', CURRENT_DATE - 1),
        (p_user_id, v_acc_forex_2, 'XAUUSD', 'BUY', 0.1, 2350.50, 2385.20, 347.00, 'Closed', CURRENT_DATE - 5);

    -- 9. More Goals
    INSERT INTO public.goals (user_id, name, target_amount, current_amount, deadline, category) VALUES 
        (p_user_id, 'Tesla Model 3', 4500000, 450000, '2028-12-31', 'Luxury'),
        (p_user_id, 'Japan Vacation', 500000, 125000, '2025-10-15', 'Travel'),
        (p_user_id, 'Emergency Fund', 1000000, 850000, '2025-01-01', 'Security');

    -- 10. Assets & Liabilities
    INSERT INTO public.alternative_assets (user_id, name, category, purchase_price, current_value, purchase_date) VALUES 
        (p_user_id, 'Rolex Submariner', 'Collectibles', 850000, 1120000, '2023-01-15'),
        (p_user_id, 'Bitcoin Holding', 'Crypto', 1500000, 4250000, '2022-06-01'),
        (p_user_id, 'Physical Gold (100g)', 'Commodity', 550000, 725000, '2021-03-10');

    INSERT INTO public.liabilities (user_id, name, category, total_amount, remaining_amount, interest_rate, monthly_payment) VALUES 
        (p_user_id, 'Education Loan', 'Education', 1500000, 825000, 7.5, 25000),
        (p_user_id, 'Home Loan (HDFC)', 'Home', 8500000, 6420000, 8.9, 72000);

    RETURN json_build_object('success', true, 'message', 'High-volume institutional data ecosystem deployed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-seed for all existing users
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT id FROM public.profiles) LOOP
        PERFORM seed_everything_v16(r.id);
    END LOOP;
END $$;
