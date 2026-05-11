
-- Comprehensive Demo Data Seeding for FinanceOS (Updated v4 - With Revert Support)
CREATE OR REPLACE FUNCTION seed_demo_data() RETURNS JSON AS $$
DECLARE
    v_user_id UUID;
    v_acc_hdfc UUID;
    v_acc_icici UUID;
    v_acc_cash UUID;
    v_acc_forex UUID;
    v_bond_id UUID;
    v_stock_trade_id UUID;
    v_expense_id UUID;
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
        (v_user_id, 'TATAMOTORS.NS', 'Tata Motors', 120, 420.00, 950.20, 'Automobile', 'Large Cap');

    INSERT INTO public.stock_trades (user_id, symbol, quantity, price, trade_type, trade_date)
    VALUES (v_user_id, 'INFY.NS', 40, 1380.00, 'BUY', CURRENT_DATE - 20)
    RETURNING id INTO v_stock_trade_id;

    -- 3. Mutual Funds
    INSERT INTO public.mutual_funds (user_id, scheme_name, scheme_code, units, avg_nav, current_nav, category)
    VALUES 
        (v_user_id, 'Parag Parikh Flexi Cap Fund', '122639', 1250.45, 42.50, 68.20, 'Flexi Cap');

    -- 4. Bonds
    INSERT INTO public.bonds (user_id, bond_name, isin, issuer, bond_type, face_value, quantity, purchase_price, current_price, total_invested, current_value, coupon_rate, ytm, purchase_date, maturity_date, status)
    VALUES (v_user_id, 'NHAI Tax Free 2034', 'INE906B07ED2', 'NHAI', 'Government', 1000, 15, 1120.00, 1150.00, 16800.00, 17250.00, 8.20, 7.10, '2023-11-15', '2034-11-15', 'Active')
    RETURNING id INTO v_bond_id;

    -- 5. Forex
    INSERT INTO public.forex_accounts (user_id, broker_name, account_label, balance, currency, total_deposited)
    VALUES (v_user_id, 'Exness Global', 'Standard MT5', 2450.50, 'USD', 2000.00)
    RETURNING id INTO v_acc_forex;

    -- 6. Expenses
    INSERT INTO public.expenses (user_id, amount, description, category, date, account_id)
    VALUES (v_user_id, 8500, 'Whole Foods Grocery', 'Food', CURRENT_DATE - 7, v_acc_icici)
    RETURNING id INTO v_expense_id;

    -- 7. Ledger Logs (History with Revert Capability)
    INSERT INTO public.ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
    VALUES 
        (v_user_id, v_acc_hdfc, 'HDFC Salary Account', 'ADJUST_UP', 245000, 0, 245000, 'Initial balance setup', gen_random_uuid(), 'manual'),
        (v_user_id, v_acc_icici, 'ICICI Spending', 'ADJUST_DOWN', 8500, 93500, 85000, 'Grocery Shopping', v_expense_id, 'expense'),
        (v_user_id, v_acc_hdfc, 'HDFC Salary Account', 'ADJUST_DOWN', 55200, 300200, 245000, 'Stock Purchase: Infosys', v_stock_trade_id, 'stock');

    -- 8. Goals
    INSERT INTO public.goals (user_id, name, target_amount, current_amount, deadline, category, status)
    VALUES (v_user_id, 'Emergency Fund', 500000, 245000, '2026-12-31', 'Safety', 'In Progress');

    -- 9. Assets & Liabilities
    INSERT INTO public.alternative_assets (user_id, name, category, purchase_price, current_value, purchase_date)
    VALUES (v_user_id, 'Rolex Submariner', 'Collectibles', 850000, 1100000, '2022-04-12');

    INSERT INTO public.liabilities (user_id, name, category, total_amount, remaining_amount, interest_rate, monthly_payment)
    VALUES (v_user_id, 'Education Loan', 'Education', 1500000, 850000, 7.5, 25000);

    RETURN json_build_object('success', true, 'message', 'Institutional Demo Ecosystem Deployed with Revert Support');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
