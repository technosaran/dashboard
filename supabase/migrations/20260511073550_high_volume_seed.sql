
-- High Volume Institutional Data Seeding (v17 - Conflict Free)
-- Coverage: 5-10 records per module with unique keys to avoid constraint violations
CREATE OR REPLACE FUNCTION seed_everything_v17(p_user_id UUID) RETURNS JSON AS $$
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
BEGIN
    -- 1. Diverse Accounts (Unique names to avoid potential conflicts)
    INSERT INTO public.accounts (user_id, name, type, balance, currency, bank_name, color)
    VALUES (p_user_id, 'HDFC Premium Plus', 'savings', 525000.00, 'INR', 'HDFC Bank', '#1e40af') RETURNING id INTO v_acc_hdfc;
    
    INSERT INTO public.accounts (user_id, name, type, balance, currency, bank_name, color)
    VALUES (p_user_id, 'ICICI Signature Credit', 'credit', -45000.00, 'INR', 'ICICI Bank', '#ea580c') RETURNING id INTO v_acc_icici;

    INSERT INTO public.accounts (user_id, name, type, balance, currency, bank_name, color)
    VALUES (p_user_id, 'SBI PPF Reserve', 'savings', 2500000.00, 'INR', 'State Bank of India', '#0284c7') RETURNING id INTO v_acc_sbi;

    INSERT INTO public.accounts (user_id, name, type, balance, currency, bank_name, color)
    VALUES (p_user_id, 'Axis Wealth Elite', 'investment', 1500000.00, 'INR', 'Axis Bank', '#9d174d') RETURNING id INTO v_acc_axis;

    INSERT INTO public.accounts (user_id, name, type, balance, currency, color)
    VALUES (p_user_id, 'Tactical Cash Fund', 'savings', 45000.00, 'INR', '#16a34a') RETURNING id INTO v_acc_cash;

    -- 2. Diverse Recipients
    INSERT INTO public.recipients (user_id, name, relationship) VALUES 
        (p_user_id, 'Jessica (Sister)', 'Family'),
        (p_user_id, 'Mark (Contractor)', 'Other'),
        (p_user_id, 'Oliver (Cousin)', 'Family'),
        (p_user_id, 'Sophia (Business Mentor)', 'Friend');

    -- 3. Rich Income History
    INSERT INTO public.incomes (user_id, amount, description, category, date, account_id) VALUES 
        (p_user_id, 225000.00, 'Quarterly Dividend Payout', 'Others', '2026-05-10', v_acc_axis),
        (p_user_id, 85000.00, 'Consulting Retainer - TechCorp', 'Work', '2026-05-08', v_acc_axis),
        (p_user_id, 12000.00, 'Etsy Shop Sales', 'Business', '2026-05-07', v_acc_icici),
        (p_user_id, 35000.00, 'Referral Commissions', 'Others', '2026-05-06', v_acc_hdfc);

    -- 4. Realistic Expenses
    INSERT INTO public.expenses (user_id, amount, description, category, date, account_id) VALUES 
        (p_user_id, 12500.00, 'Amazon - Home Office Gear', 'Shopping', CURRENT_DATE - 4, v_acc_icici),
        (p_user_id, 4200.00, 'Uber Premier Rides', 'Transport', CURRENT_DATE - 3, v_acc_icici),
        (p_user_id, 15800.00, 'Whole Foods - Monthly Groceries', 'Food', CURRENT_DATE - 8, v_acc_hdfc),
        (p_user_id, 24000.00, 'Family Dinner - Ritz Carlton', 'Food', CURRENT_DATE - 12, v_acc_hdfc);

    -- 5. Broad Stock Portfolio (Using Unique Symbols to avoid idx_unique_investment_per_user)
    INSERT INTO public.investments (user_id, name, type, symbol, quantity, buy_price, current_price) VALUES 
        (p_user_id, 'Titan Company Ltd', 'stock', 'TITAN.NS', 45, 2850.00, 3210.50),
        (p_user_id, 'Adani Enterprises', 'stock', 'ADANIENT.NS', 100, 2100.00, 3150.20),
        (p_user_id, 'Asian Paints', 'stock', 'ASIANPAINT.NS', 20, 2900.00, 2840.00),
        (p_user_id, 'NVIDIA Corp', 'stock', 'NVDA', 5, 450.00, 895.50),
        (p_user_id, 'Microsoft Corp', 'stock', 'MSFT', 15, 310.00, 415.00);

    -- 6. Diverse Mutual Funds
    INSERT INTO public.mutual_funds (user_id, fund_name, fund_symbol, units, avg_nav, current_nav, category) VALUES 
        (p_user_id, 'Nippon India Small Cap', '100451', 2500.00, 95.50, 158.10, 'Small Cap'),
        (p_user_id, 'Parag Parikh Tax Saver', '145236', 1200.12, 18.20, 32.80, 'ELSS'),
        (p_user_id, 'HDFC Index S&P BSE 500', '142635', 8500.00, 25.50, 31.20, 'Index');

    -- 7. High Yield Bonds
    INSERT INTO public.bonds (user_id, bond_name, isin, issuer, bond_type, face_value, quantity, purchase_price, current_price, total_invested, current_value, coupon_rate, ytm, purchase_date, maturity_date, status) VALUES 
        (p_user_id, 'NABARD Green Bond', 'INE261F07632', 'NABARD', 'Government', 1000, 75, 1050.00, 1090.00, 78750.00, 81750.00, 7.80, 7.20, '2023-06-01', '2030-06-01', 'Active');

    -- 8. Global Forex Accounts
    INSERT INTO public.forex_accounts (user_id, broker_name, account_label, balance, currency, total_deposited)
    VALUES (p_user_id, 'Swissquote', 'High Leverage AC', 25000.00, 'USD', 20000.00) RETURNING id INTO v_acc_forex_1;

    INSERT INTO public.forex_trades (user_id, forex_account_id, pair, trade_type, lot_size, entry_price, exit_price, pnl, status, trade_date) VALUES 
        (p_user_id, v_acc_forex_1, 'USDJPY', 'BUY', 2.0, 151.50, 156.20, 4200.00, 'Closed', CURRENT_DATE - 4),
        (p_user_id, v_acc_forex_1, 'AUDUSD', 'SELL', 1.5, 0.6650, 0.6580, 1250.00, 'Closed', CURRENT_DATE - 1);

    -- 9. Strategic Goals
    INSERT INTO public.goals (user_id, name, target_amount, current_amount, deadline, category) VALUES 
        (p_user_id, 'Early Retirement', 50000000, 4200000, '2040-01-01', 'Security'),
        (p_user_id, 'World Tour 2026', 1500000, 350000, '2026-06-01', 'Travel');

    -- 10. High-Value Assets & Strategic Liabilities
    INSERT INTO public.alternative_assets (user_id, name, category, purchase_price, current_value, purchase_date) VALUES 
        (p_user_id, 'Ethereum Portfolio', 'Crypto', 1500000, 3200000, '2023-03-01'),
        (p_user_id, 'Commercial Office Space', 'Real Estate', 12000000, 14500000, '2022-10-15');

    INSERT INTO public.liabilities (user_id, name, category, total_amount, remaining_amount, interest_rate, monthly_payment) VALUES 
        (p_user_id, 'Tesla Model S Loan', 'Vehicle', 6500000, 4120000, 6.8, 85000);

    RETURN json_build_object('success', true, 'message', 'Ultra-high volume data expansion successful');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-seed for all existing users
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT id FROM public.profiles) LOOP
        PERFORM seed_everything_v17(r.id);
    END LOOP;
END $$;
