-- Script to populate sample data for testing the new modules
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get the current user
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;

    IF v_user_id IS NOT NULL THEN
        -- 1. Sample Budgets
        INSERT INTO public.budgets (user_id, category, amount, period_month, period_year)
        VALUES 
            (v_user_id, 'Food', 15000, extract(month from now()), extract(year from now())),
            (v_user_id, 'Travel', 8000, extract(month from now()), extract(year from now())),
            (v_user_id, 'Shopping', 5000, extract(month from now()), extract(year from now())),
            (v_user_id, 'Utilities', 4000, extract(month from now()), extract(year from now()))
        ON CONFLICT (user_id, category, period_month, period_year) DO UPDATE SET amount = EXCLUDED.amount;

        -- 2. Sample Alternative Assets
        INSERT INTO public.alternative_assets (user_id, name, category, purchase_price, current_value, purchase_date, notes)
        VALUES 
            (v_user_id, 'Skyline Apartment', 'Real Estate', 4500000, 5200000, '2023-01-15', 'Prime location, 2BHK'),
            (v_user_id, 'Gold Sovereign', 'Gold / Precious Metals', 120000, 145000, '2023-06-20', 'Physical gold coins'),
            (v_user_id, 'Bored Ape NFT #42', 'Collectibles', 50000, 12000, '2024-02-10', 'Digital art collection')
        ON CONFLICT DO NOTHING;

        -- 3. Sample Liabilities
        INSERT INTO public.liabilities (user_id, name, category, total_amount, remaining_amount, interest_rate, monthly_payment, due_date, notes)
        VALUES 
            (v_user_id, 'SBI Home Loan', 'Home Loan', 4000000, 3650000, 8.5, 32000, '2026-06-05', 'Principal repayment active'),
            (v_user_id, 'HDFC Personal Loan', 'Personal Loan', 500000, 210000, 11.0, 15000, '2026-06-12', 'Consolidation loan'),
            (v_user_id, 'Apple iPhone EMI', 'EMI', 80000, 24000, 0.0, 8000, '2026-06-25', 'No cost EMI')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
