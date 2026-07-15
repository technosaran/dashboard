-- FinanceOS Database Seed Script (6-Month Portfolio: Jan 1, 2026 to Present)
-- Keep USD and INR strictly separate. Maintain consistent Double-Entry Ledger Logs.

DO $$
DECLARE
    v_user_id UUID;
    v_acc_hdfc UUID;
    v_acc_icici UUID;
    v_acc_sbi UUID;
    v_acc_chase UUID;
    v_acc_crypto UUID;
    
    v_rec_sarah UUID;
    v_rec_landlord UUID;
    
    v_stk_reliance UUID;
    v_stk_tcs UUID;
    v_stk_apple UUID;
    
    v_mf_sbi UUID;
    v_mf_mirae UUID;
    
    v_bond_nhai UUID;
    
    v_goal_car UUID;
    
    v_date TIMESTAMP;
    v_balance NUMERIC;
    v_prev_bal NUMERIC;
    v_amount NUMERIC;
BEGIN
    -- 1. Get the first registered profile from the database
    SELECT id INTO v_user_id FROM public.profiles LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No user profiles found in the database. Please register a user first.';
    END IF;

    RAISE NOTICE 'Seeding database for user: %', v_user_id;

    -- 2. Clean existing user data
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
    DELETE FROM public.forex_trades WHERE user_id = v_user_id;
    DELETE FROM public.forex_accounts WHERE user_id = v_user_id;
    DELETE FROM public.goals WHERE user_id = v_user_id;
    DELETE FROM public.recipients WHERE user_id = v_user_id;
    DELETE FROM public.accounts WHERE user_id = v_user_id;

    -- ==========================================
    -- 3. ACCOUNTS (INR and USD kept strictly isolated)
    -- ==========================================
    v_acc_hdfc := gen_random_uuid();
    v_acc_icici := gen_random_uuid();
    v_acc_sbi := gen_random_uuid();
    v_acc_chase := gen_random_uuid();
    v_acc_crypto := gen_random_uuid();

    -- INR Accounts
    INSERT INTO public.accounts (id, user_id, name, type, balance, currency, bank_name, color) VALUES 
        (v_acc_hdfc, v_user_id, 'HDFC Premium Savings', 'savings', 450000.00, 'INR', 'HDFC Bank', '#1e40af'),
        (v_acc_icici, v_user_id, 'ICICI Platinum Credit', 'credit', -15400.00, 'INR', 'ICICI Bank', '#ea580c'),
        (v_acc_sbi, v_user_id, 'SBI Provident Fund', 'savings', 800000.00, 'INR', 'State Bank of India', '#0284c7');

    -- USD Accounts
    INSERT INTO public.accounts (id, user_id, name, type, balance, currency, bank_name, color) VALUES 
        (v_acc_chase, v_user_id, 'Chase Checking Account', 'checking', 8500.00, 'USD', 'Chase Bank', '#0ea5e9'),
        (v_acc_crypto, v_user_id, 'Crypto Spot Account', 'investment', 12500.00, 'USD', 'Binance Spot', '#8b5cf6');

    -- ==========================================
    -- 4. RECIPIENTS (Family)
    -- ==========================================
    v_rec_sarah := gen_random_uuid();
    v_rec_landlord := gen_random_uuid();
    INSERT INTO public.recipients (id, user_id, name, relationship) VALUES 
        (v_rec_sarah, v_user_id, 'Sarah (Wife)', 'Family'),
        (v_rec_landlord, v_user_id, 'Mr. Verma (Landlord)', 'Other');

    -- ==========================================
    -- 5. MONTHLY CASH FLOW EVENTS (Jan 1, 2026 to Present)
    -- ==========================================
    
    -- Loop through 6 months (Jan to June) to seed Salary, Rent, and Bills
    FOR i IN 0..5 LOOP
        v_date := '2026-01-01'::TIMESTAMP + (i || ' month')::INTERVAL;
        
        -- A. Monthly Salary Credit (INR - ₹1,20,000)
        v_amount := 120000.00;
        INSERT INTO public.incomes (id, user_id, account_id, amount, category, description, date) 
            VALUES (gen_random_uuid(), v_user_id, v_acc_hdfc, v_amount, 'Salary', 'Executive Monthly Salary', v_date);
            
        INSERT INTO public.transactions (user_id, account_id, description, amount, type, category, date) 
            VALUES (v_user_id, v_acc_hdfc, 'Salary Deposit', v_amount, 'income', 'Salary', v_date);
            
        -- B. Rent Expense (INR - ₹25,000)
        v_amount := 25000.00;
        INSERT INTO public.expenses (id, user_id, account_id, amount, category, description, date) 
            VALUES (gen_random_uuid(), v_user_id, v_acc_hdfc, v_amount, 'Housing', 'Monthly Apartment Rent', v_date + '2 days'::INTERVAL);
            
        INSERT INTO public.transactions (user_id, account_id, description, amount, type, category, date) 
            VALUES (v_user_id, v_acc_hdfc, 'Apartment Rent', v_amount, 'expense', 'Housing', v_date + '2 days'::INTERVAL);

        -- C. Groceries & Essentials (INR - ₹8,000)
        v_amount := 8000.00;
        INSERT INTO public.expenses (id, user_id, account_id, amount, category, description, date) 
            VALUES (gen_random_uuid(), v_user_id, v_acc_hdfc, v_amount, 'Food', 'Groceries & Household Supplies', v_date + '10 days'::INTERVAL);
            
        INSERT INTO public.transactions (user_id, account_id, description, amount, type, category, date) 
            VALUES (v_user_id, v_acc_hdfc, 'Groceries Purchase', v_amount, 'expense', 'Food', v_date + '10 days'::INTERVAL);
            
        -- D. USD Salary Retainer (USD - $2,500)
        v_amount := 2500.00;
        INSERT INTO public.incomes (id, user_id, account_id, amount, category, description, date) 
            VALUES (gen_random_uuid(), v_user_id, v_acc_chase, v_amount, 'Work', 'USD Tech Consulting Retainer', v_date + '5 days'::INTERVAL);
            
        INSERT INTO public.transactions (user_id, account_id, description, amount, type, category, date) 
            VALUES (v_user_id, v_acc_chase, 'Consulting Retainer Credit', v_amount, 'income', 'Work', v_date + '5 days'::INTERVAL);
    END LOOP;

    -- ==========================================
    -- 6. STOCK PORTFOLIO (INR & USD separate)
    -- ==========================================
    v_stk_reliance := gen_random_uuid();
    v_stk_tcs := gen_random_uuid();
    v_stk_apple := gen_random_uuid();

    -- Reliance (INR Stock)
    INSERT INTO public.investments (id, user_id, symbol, name, quantity, buy_price, current_price, currency, type) VALUES 
        (v_stk_reliance, v_user_id, 'RELIANCE.NS', 'Reliance Industries Ltd.', 50, 2400.00, 2910.50, 'INR', 'stock');
    INSERT INTO public.stock_trades (id, user_id, investment_id, symbol, trade_type, quantity, price, total_amount, trade_date) VALUES
        (gen_random_uuid(), v_user_id, v_stk_reliance, 'RELIANCE.NS', 'buy', 50, 2400.00, 120000.00, '2026-01-15'::TIMESTAMP);

    -- TCS (INR Stock)
    INSERT INTO public.investments (id, user_id, symbol, name, quantity, buy_price, current_price, currency, type) VALUES 
        (v_stk_tcs, v_user_id, 'TCS.NS', 'Tata Consultancy Services', 15, 3400.00, 3950.00, 'INR', 'stock');
    INSERT INTO public.stock_trades (id, user_id, investment_id, symbol, trade_type, quantity, price, total_amount, trade_date) VALUES
        (gen_random_uuid(), v_user_id, v_stk_tcs, 'TCS.NS', 'buy', 15, 3400.00, 51000.00, '2026-02-10'::TIMESTAMP);

    -- Apple (USD Stock)
    INSERT INTO public.investments (id, user_id, symbol, name, quantity, buy_price, current_price, currency, type) VALUES 
        (v_stk_apple, v_user_id, 'AAPL', 'Apple Inc.', 30, 160.00, 182.20, 'USD', 'stock');
    INSERT INTO public.stock_trades (id, user_id, investment_id, symbol, trade_type, quantity, price, total_amount, trade_date) VALUES
        (gen_random_uuid(), v_user_id, v_stk_apple, 'AAPL', 'buy', 30, 160.00, 4800.00, '2026-01-20'::TIMESTAMP);

    -- ==========================================
    -- 7. MUTUAL FUNDS (INR)
    -- ==========================================
    v_mf_sbi := gen_random_uuid();
    v_mf_mirae := gen_random_uuid();

    INSERT INTO public.mutual_funds (id, user_id, fund_name, fund_symbol, units, avg_nav, current_nav, category) VALUES 
        (v_mf_sbi, v_user_id, 'SBI Bluechip Fund', '103504', 500.0, 60.00, 82.50, 'Large Cap'),
        (v_mf_mirae, v_user_id, 'Mirae Asset Large Cap', '112093', 1000.0, 110.00, 128.40, 'Large Cap');

    INSERT INTO public.mutual_fund_trades (id, user_id, account_id, mf_id, fund_name, trade_type, units, nav, amount, date) VALUES
        (gen_random_uuid(), v_user_id, v_acc_hdfc, v_mf_sbi, 'SBI Bluechip Fund', 'BUY', 500.0, 60.00, 30000.00, '2026-01-10'::TIMESTAMP);

    -- ==========================================
    -- 8. CRYPTOCURRENCIES (USD/USDT - kept strictly USD)
    -- ==========================================
    INSERT INTO public.investments (id, user_id, symbol, name, quantity, buy_price, current_price, currency, type) VALUES 
        (gen_random_uuid(), v_user_id, 'BTC', 'Bitcoin', 0.1, 41200.00, 63850.00, 'USD', 'crypto'),
        (gen_random_uuid(), v_user_id, 'ETH', 'Ethereum', 2.0, 2300.00, 3420.00, 'USD', 'crypto'),
        (gen_random_uuid(), v_user_id, 'SOL', 'Solana', 20.0, 110.00, 142.50, 'USD', 'crypto');

    -- ==========================================
    -- 9. BONDS (INR)
    -- ==========================================
    v_bond_nhai := gen_random_uuid();
    INSERT INTO public.bonds (id, user_id, bond_name, isin, issuer, bond_type, face_value, quantity, purchase_price, current_price, total_invested, current_value, coupon_rate, purchase_date, maturity_date, status) VALUES 
        (v_bond_nhai, v_user_id, 'NHAI Tax Free Bond', 'INE906B07ED2', 'NHAI', 'Government', 1000, 15, 1000.00, 1040.00, 15000.00, 15600.00, 8.20, '2026-01-08', '2036-01-08', 'Active');

    INSERT INTO public.bond_transactions (id, user_id, account_id, bond_id, transaction_type, quantity, price_per_bond, amount, transaction_date) VALUES
        (gen_random_uuid(), v_user_id, v_acc_hdfc, v_bond_nhai, 'BUY', 15, 1000.00, 15000.00, '2026-01-08');

    -- ==========================================
    -- 10. LIABILITIES & GOALS (INR)
    -- ==========================================
    v_goal_car := gen_random_uuid();
    INSERT INTO public.goals (id, user_id, name, target_amount, current_amount, deadline, category) VALUES 
        (v_goal_car, v_user_id, 'New Luxury SUV', 3500000, 500000, '2028-12-31', 'Luxury');

    INSERT INTO public.liabilities (id, user_id, name, category, total_amount, remaining_amount, interest_rate, monthly_payment) VALUES 
        (gen_random_uuid(), v_user_id, 'HDFC Education Loan', 'Education', 500000.00, 320000.00, 7.8, 12000.00);

    -- ==========================================
    -- 11. LEDGER AUDIT LOGS (To match account balances)
    -- ==========================================
    INSERT INTO public.ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, created_at) VALUES
        (gen_random_uuid(), v_user_id, v_acc_hdfc, 'HDFC Premium Savings', 'ADJUST_UP', 120000.00, 330000.00, 450000.00, 'Salary deposit', '2026-06-01'::TIMESTAMP),
        (gen_random_uuid(), v_user_id, v_acc_chase, 'Chase Checking Account', 'ADJUST_UP', 2500.00, 6000.00, 8500.00, 'Consulting retainer credit', '2026-06-05'::TIMESTAMP);

    RAISE NOTICE 'Database seeding successfully completed for all sections!';
END;
$$;
