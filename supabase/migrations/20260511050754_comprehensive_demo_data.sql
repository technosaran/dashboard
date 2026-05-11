
-- Comprehensive Demo Data Seeding for FinanceOS
CREATE OR REPLACE FUNCTION seed_demo_data() RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_acc_hdfc UUID;
    v_acc_icici UUID;
    v_acc_cash UUID;
    v_acc_forex UUID;
    v_bond_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- 1. Accounts
    INSERT INTO public.accounts (user_id, name, type, balance, currency, bank_name, color)
    VALUES (v_user_id, 'HDFC Salary Account', 'savings', 245000, 'INR', 'HDFC Bank', '#1e40af')
    RETURNING id INTO v_acc_hdfc;

    INSERT INTO public.accounts (user_id, name, type, balance, currency, bank_name, color)
    VALUES (v_user_id, 'ICICI Spending', 'checking', 85000, 'INR', 'ICICI Bank', '#ea580c')
    RETURNING id INTO v_acc_icici;

    INSERT INTO public.accounts (user_id, name, type, balance, currency, color)
    VALUES (v_user_id, 'Physical Cash', 'savings', 4500, 'INR', '#16a34a')
    RETURNING id INTO v_acc_cash;

    -- 2. Stocks (Investments)
    INSERT INTO public.investments (user_id, symbol, name, quantity, buy_price, current_price, sector, category)
    VALUES 
        (v_user_id, 'RELIANCE.NS', 'Reliance Industries', 50, 2450.00, 2850.50, 'Energy', 'Large Cap'),
        (v_user_id, 'TATAMOTORS.NS', 'Tata Motors', 120, 420.00, 950.20, 'Automobile', 'Large Cap'),
        (v_user_id, 'INFY.NS', 'Infosys', 40, 1380.00, 1520.10, 'IT', 'Large Cap'),
        (v_user_id, 'ZOMATO.NS', 'Zomato Ltd', 500, 65.00, 185.40, 'Consumer', 'Mid Cap');

    -- 3. Mutual Funds
    INSERT INTO public.mutual_funds (user_id, scheme_name, scheme_code, units, avg_nav, current_nav, category)
    VALUES 
        (v_user_id, 'Parag Parikh Flexi Cap Fund', '122639', 1250.45, 42.50, 68.20, 'Flexi Cap'),
        (v_user_id, 'Quant Small Cap Fund', '120844', 450.20, 145.00, 210.50, 'Small Cap');

    -- 4. Bonds
    INSERT INTO public.bonds (user_id, bond_name, isin, issuer, bond_type, face_value, quantity, purchase_price, current_price, total_invested, current_value, coupon_rate, ytm, purchase_date, maturity_date, status)
    VALUES (v_user_id, 'NHAI Tax Free 2034', 'INE906B07ED2', 'NHAI', 'Government', 1000, 15, 1120.00, 1150.00, 16800.00, 17250.00, 8.20, 7.10, '2023-11-15', '2034-11-15', 'Active')
    RETURNING id INTO v_bond_id;

    INSERT INTO public.bond_transactions (user_id, bond_id, transaction_type, transaction_date, quantity, price_per_bond, amount, account_id)
    VALUES (v_user_id, v_bond_id, 'BUY', '2023-11-15', 15, 1120.00, 16800.00, v_acc_hdfc);

    -- 5. Forex
    INSERT INTO public.forex_accounts (user_id, broker_name, account_label, balance, currency, total_deposited)
    VALUES (v_user_id, 'Exness Global', 'Standard MT5', 2450.50, 'USD', 2000.00)
    RETURNING id INTO v_acc_forex;

    INSERT INTO public.forex_trades (user_id, forex_account_id, pair, trade_type, lot_size, entry_price, exit_price, pnl, status, trade_date)
    VALUES 
        (v_user_id, v_acc_forex, 'EURUSD', 'BUY', 0.1, 1.0850, 1.0920, 70.00, 'Closed', CURRENT_DATE - 5),
        (v_user_id, v_acc_forex, 'XAUUSD', 'SELL', 0.05, 2350.00, 2320.00, 150.00, 'Closed', CURRENT_DATE - 2);

    -- 6. Income & Expenses
    INSERT INTO public.incomes (user_id, amount, source, category, date, account_id)
    VALUES 
        (v_user_id, 125000, 'Monthly Salary', 'Salary', CURRENT_DATE - 10, v_acc_hdfc),
        (v_user_id, 15000, 'Freelance Project', 'Side Hustle', CURRENT_DATE - 5, v_acc_icici);

    INSERT INTO public.expenses (user_id, amount, description, category, date, account_id)
    VALUES 
        (v_user_id, 35000, 'Apartment Rent', 'Housing', CURRENT_DATE - 9, v_acc_icici),
        (v_user_id, 8500, 'Whole Foods Grocery', 'Food', CURRENT_DATE - 7, v_acc_icici),
        (v_user_id, 2400, 'Netflix & Spotify', 'Entertainment', CURRENT_DATE - 4, v_acc_hdfc),
        (v_user_id, 12000, 'Shopping Spree', 'Lifestyle', CURRENT_DATE - 2, v_acc_icici);

    -- 7. Goals
    INSERT INTO public.goals (user_id, name, target_amount, current_amount, deadline, category, status)
    VALUES 
        (v_user_id, 'Emergency Fund', 500000, 245000, '2026-12-31', 'Safety', 'In Progress'),
        (v_user_id, 'Tesla Model 3', 4500000, 120000, '2028-06-30', 'Luxury', 'In Progress');

    -- 8. Family (Recipients)
    INSERT INTO public.recipients (user_id, name, relationship, bank_name, account_number)
    VALUES 
        (v_user_id, 'Sarah (Wife)', 'Spouse', 'HDFC', '9988776655'),
        (v_user_id, 'John (Dad)', 'Parent', 'SBI', '1122334455');

    -- 9. Assets & Liabilities
    INSERT INTO public.alternative_assets (user_id, name, category, purchase_price, current_value, purchase_date)
    VALUES 
        (v_user_id, 'Rolex Submariner', 'Collectibles', 850000, 1100000, '2022-04-12'),
        (v_user_id, 'Tech Startup Equity', 'Venture', 500000, 500000, '2024-01-01');

    INSERT INTO public.liabilities (user_id, name, category, total_amount, remaining_amount, interest_rate, monthly_payment)
    VALUES 
        (v_user_id, 'Education Loan', 'Education', 1500000, 850000, 7.5, 25000),
        (v_user_id, 'Credit Card Dues', 'Consumer', 45000, 45000, 36.0, 5000);

    -- 10. Budgets
    INSERT INTO public.budgets (user_id, category, amount, period_month, period_year)
    VALUES 
        (v_user_id, 'Food', 20000, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE)),
        (v_user_id, 'Housing', 40000, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE)),
        (v_user_id, 'Lifestyle', 15000, EXTRACT(MONTH FROM CURRENT_DATE), EXTRACT(YEAR FROM CURRENT_DATE));

    -- 11. Transfers
    INSERT INTO public.transfers (user_id, from_account_id, to_account_id, amount, note)
    VALUES (v_user_id, v_acc_hdfc, v_acc_icici, 25000, 'Monthly pocket money transfer');

    -- 12. Ledger Logs (History)
    INSERT INTO public.ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
    VALUES 
        (v_user_id, v_acc_hdfc, 'HDFC Salary Account', 'CREATE', 245000, 0, 245000, 'Initial balance setup'),
        (v_user_id, v_acc_icici, 'ICICI Spending', 'ADJUST_UP', 25000, 60000, 85000, 'Transfer from HDFC'),
        (v_user_id, v_acc_hdfc, 'HDFC Salary Account', 'ADJUST_DOWN', 16800, 261800, 245000, 'Bond Purchase: NHAI Tax Free');

    RETURN json_build_object('success', true, 'message', 'Institutional Demo Ecosystem Deployed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
