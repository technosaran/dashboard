-- Migration: Comprehensive Database Improvements
-- Date: 2026-06-19
-- Purpose: Bug fixes, RLS optimization, performance indexes, schema improvements, new atomic RPCs, and permission hardening.

-- ============================================================================
-- 1. BUG FIX: fno_log_trade() — Fix p_quantity from INTEGER back to NUMERIC(18,6)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fno_log_trade(
    p_user_id UUID,
    p_symbol TEXT,
    p_instrument_type TEXT,
    p_strike_price NUMERIC,
    p_expiry_date DATE,
    p_trade_type TEXT,
    p_quantity NUMERIC(18,6),  -- FIXED: was INTEGER in 20260614000000, must match fno_trades.quantity
    p_entry_price NUMERIC,
    p_account_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_trade_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
    v_old_bal NUMERIC := 0;
    v_acc_name TEXT := 'Suspense';
    v_premium NUMERIC;
    v_trade_id UUID;
    v_log_id UUID := NULL;
    v_details TEXT;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    IF p_quantity <= 0 OR p_entry_price <= 0 THEN 
        RAISE EXCEPTION 'Invalid quantity or entry price'; 
    END IF;

    v_premium := p_quantity * p_entry_price;

    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
        
        IF p_trade_type = 'BUY' THEN
            IF v_old_bal < v_premium THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
            UPDATE accounts SET balance = balance - v_premium WHERE id = p_account_id;
        ELSE
            UPDATE accounts SET balance = balance + v_premium WHERE id = p_account_id;
        END IF;
    END IF;

    v_details := p_trade_type || ' ' || p_quantity || ' ' || p_symbol || ' ' || p_instrument_type || 
                 CASE WHEN p_strike_price IS NOT NULL THEN ' ' || p_strike_price ELSE '' END || 
                 ' Exp ' || to_char(p_expiry_date, 'YYYY-MM-DD');

    -- Pre-generate IDs to avoid UPDATE on ledger_logs (immutability)
    v_trade_id := gen_random_uuid();
    
    IF p_account_id IS NOT NULL THEN
        v_log_id := gen_random_uuid();
        INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (
            v_log_id, p_user_id, p_account_id, v_acc_name, 
            CASE WHEN p_trade_type = 'BUY' THEN 'ADJUST_DOWN' ELSE 'ADJUST_UP' END, 
            v_premium, v_old_bal, 
            CASE WHEN p_trade_type = 'BUY' THEN v_old_bal - v_premium ELSE v_old_bal + v_premium END, 
            'FnO Position opened: ' || v_details, v_trade_id, 'fno_trade'
        );
    END IF;

    INSERT INTO fno_trades (
        id, user_id, symbol, instrument_type, strike_price, expiry_date, 
        trade_type, quantity, entry_price, status, account_id, ledger_log_id, notes, trade_date
    ) VALUES (
        v_trade_id, p_user_id, UPPER(p_symbol), UPPER(p_instrument_type), p_strike_price, p_expiry_date, 
        p_trade_type, p_quantity, p_entry_price, 'OPEN', p_account_id, v_log_id, p_notes, p_trade_date
    );

    IF p_account_id IS NOT NULL THEN
        INSERT INTO transactions (user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (
            p_user_id, p_account_id, 'FnO Open: ' || v_details, v_premium, 
            CASE WHEN p_trade_type = 'BUY' THEN 'expense' ELSE 'income' END, 
            'Investments', p_trade_date, v_trade_id, 'fno_trade', v_log_id
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'trade_id', v_trade_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;


-- ============================================================================
-- 2. BUG FIX: get_investments_v1() — Add search_path + LIMIT on fnoTrades
-- ============================================================================
CREATE OR REPLACE FUNCTION get_investments_v1()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    SELECT json_build_object(
        'investments', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.investments WHERE user_id = v_user_id ORDER BY current_price * quantity DESC) t),
        'mutualFunds', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.mutual_funds WHERE user_id = v_user_id) t),
        'bonds', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.bonds WHERE user_id = v_user_id ORDER BY maturity_date ASC) t),
        'alternativeAssets', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.alternative_assets WHERE user_id = v_user_id ORDER BY current_value DESC) t),
        'stockTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.stock_trades WHERE user_id = v_user_id ORDER BY trade_date DESC LIMIT 50) t),
        'mutualFundTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.mutual_fund_trades WHERE user_id = v_user_id ORDER BY date DESC LIMIT 50) t),
        'bondTransactions', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.bond_transactions WHERE user_id = v_user_id ORDER BY transaction_date DESC LIMIT 50) t),
        'fnoTrades', (SELECT coalesce(json_agg(t), '[]'::json) FROM (SELECT * FROM public.fno_trades WHERE user_id = v_user_id ORDER BY trade_date DESC, created_at DESC LIMIT 100) t)
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;


-- ============================================================================
-- 3. RLS INITPLAN OPTIMIZATION — 13 core tables
-- ============================================================================

-- 3a. accounts
DROP POLICY IF EXISTS "Users can manage their own accounts" ON public.accounts;
CREATE POLICY "Users can manage their own accounts" ON public.accounts
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3b. transactions
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions" ON public.transactions
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3c. transfers — Fix inconsistent policies (old FOR ALL + new SELECT-only)
DROP POLICY IF EXISTS "Users can manage their own transfers" ON public.transfers;
DROP POLICY IF EXISTS "Users can view their own transfers" ON public.transfers;
CREATE POLICY "Users can manage their own transfers" ON public.transfers
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3d. profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id);

-- 3e. ledger_logs (immutable: SELECT + INSERT only)
DROP POLICY IF EXISTS "Users can view their own ledger logs" ON public.ledger_logs;
DROP POLICY IF EXISTS "Users can insert their own ledger logs" ON public.ledger_logs;
CREATE POLICY "Users can view their own ledger logs" ON public.ledger_logs
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can insert their own ledger logs" ON public.ledger_logs
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3f. incomes
DROP POLICY IF EXISTS "Users can manage their own incomes" ON public.incomes;
CREATE POLICY "Users can manage their own incomes" ON public.incomes
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3g. expenses
DROP POLICY IF EXISTS "Users can manage their own expenses" ON public.expenses;
CREATE POLICY "Users can manage their own expenses" ON public.expenses
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3h. investments
DROP POLICY IF EXISTS "Users can manage their own investments" ON public.investments;
CREATE POLICY "Users can manage their own investments" ON public.investments
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3i. stock_trades
DROP POLICY IF EXISTS "Users can manage their own stock trades" ON public.stock_trades;
CREATE POLICY "Users can manage their own stock trades" ON public.stock_trades
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3j. goals
DROP POLICY IF EXISTS "Users can manage their own goals" ON public.goals;
CREATE POLICY "Users can manage their own goals" ON public.goals
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3k. recipients
DROP POLICY IF EXISTS "Users can manage their own recipients" ON public.recipients;
CREATE POLICY "Users can manage their own recipients" ON public.recipients
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3l. mutual_funds
DROP POLICY IF EXISTS "Users can manage their own mutual funds" ON public.mutual_funds;
CREATE POLICY "Users can manage their own mutual funds" ON public.mutual_funds
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- 3m. mutual_fund_trades
DROP POLICY IF EXISTS "Users can manage their own mutual fund trades" ON public.mutual_fund_trades;
CREATE POLICY "Users can manage their own mutual fund trades" ON public.mutual_fund_trades
    FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);


-- ============================================================================
-- 4. PERFORMANCE: Missing Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_forex_trades_forex_account_id ON public.forex_trades(forex_account_id);
CREATE INDEX IF NOT EXISTS idx_fno_trades_user_status ON public.fno_trades(user_id, status);
CREATE INDEX IF NOT EXISTS idx_mf_trades_user_date ON public.mutual_fund_trades(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_bond_txns_user_date ON public.bond_transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_trades_user_trade_date ON public.stock_trades(user_id, trade_date DESC);


-- ============================================================================
-- 5. SCHEMA: updated_at columns + auto-triggers
-- ============================================================================

-- 5a. Create shared trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5b. Add updated_at column to tables that don't have it
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.transfers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.incomes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.recipients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5c. Add auto-update triggers for ALL tables with updated_at
-- Tables that just got the column
DROP TRIGGER IF EXISTS tr_accounts_updated_at ON public.accounts;
CREATE TRIGGER tr_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_transactions_updated_at ON public.transactions;
CREATE TRIGGER tr_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_transfers_updated_at ON public.transfers;
CREATE TRIGGER tr_transfers_updated_at BEFORE UPDATE ON public.transfers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_expenses_updated_at ON public.expenses;
CREATE TRIGGER tr_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_incomes_updated_at ON public.incomes;
CREATE TRIGGER tr_incomes_updated_at BEFORE UPDATE ON public.incomes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_recipients_updated_at ON public.recipients;
CREATE TRIGGER tr_recipients_updated_at BEFORE UPDATE ON public.recipients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tables that had updated_at but no auto-trigger
DROP TRIGGER IF EXISTS tr_investments_updated_at ON public.investments;
CREATE TRIGGER tr_investments_updated_at BEFORE UPDATE ON public.investments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_budgets_updated_at ON public.budgets;
CREATE TRIGGER tr_budgets_updated_at BEFORE UPDATE ON public.budgets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_alternative_assets_updated_at ON public.alternative_assets;
CREATE TRIGGER tr_alternative_assets_updated_at BEFORE UPDATE ON public.alternative_assets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_liabilities_updated_at ON public.liabilities;
CREATE TRIGGER tr_liabilities_updated_at BEFORE UPDATE ON public.liabilities FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_fno_trades_updated_at ON public.fno_trades;
CREATE TRIGGER tr_fno_trades_updated_at BEFORE UPDATE ON public.fno_trades FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- 6. NEW ATOMIC RPCs
-- ============================================================================

-- 6a. add_alternative_asset_atomic — atomically insert asset + adjust account balance
CREATE OR REPLACE FUNCTION public.add_alternative_asset_atomic(
    p_user_id UUID,
    p_name TEXT,
    p_category TEXT,
    p_purchase_price NUMERIC,
    p_current_value NUMERIC,
    p_purchase_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_asset_id UUID;
    v_old_bal NUMERIC;
    v_acc_name TEXT;
    v_log_id UUID;
    v_txn_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    IF p_purchase_price < 0 THEN RAISE EXCEPTION 'Purchase price must be non-negative'; END IF;

    -- Insert the asset
    INSERT INTO alternative_assets (user_id, name, category, purchase_price, current_value, purchase_date, notes)
    VALUES (p_user_id, p_name, p_category, p_purchase_price, p_current_value, p_purchase_date, p_notes)
    RETURNING id INTO v_asset_id;

    -- Handle account deduction if provided
    IF p_account_id IS NOT NULL AND p_purchase_price > 0 THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
        IF v_old_bal < p_purchase_price THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

        UPDATE accounts SET balance = balance - p_purchase_price WHERE id = p_account_id;

        v_log_id := gen_random_uuid();
        v_txn_id := gen_random_uuid();

        INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (v_log_id, p_user_id, p_account_id, v_acc_name, 'ADJUST_DOWN', p_purchase_price, v_old_bal, v_old_bal - p_purchase_price, 'Asset Purchase: ' || p_name, v_asset_id, 'alternative_asset');

        INSERT INTO transactions (id, user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (v_txn_id, p_user_id, p_account_id, 'Asset Purchase: ' || p_name, p_purchase_price, 'expense', 'Investments', COALESCE(p_purchase_date, CURRENT_DATE), v_asset_id, 'alternative_asset', v_log_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'asset_id', v_asset_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;


-- 6b. add_liability_atomic — atomically insert liability + adjust account balance
CREATE OR REPLACE FUNCTION public.add_liability_atomic(
    p_user_id UUID,
    p_name TEXT,
    p_category TEXT,
    p_total_amount NUMERIC,
    p_remaining_amount NUMERIC,
    p_interest_rate NUMERIC DEFAULT NULL,
    p_monthly_payment NUMERIC DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_liability_id UUID;
    v_old_bal NUMERIC;
    v_acc_name TEXT;
    v_log_id UUID;
    v_txn_id UUID;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;
    IF p_total_amount <= 0 THEN RAISE EXCEPTION 'Total amount must be positive'; END IF;

    -- Insert the liability
    INSERT INTO liabilities (user_id, name, category, total_amount, remaining_amount, interest_rate, monthly_payment, due_date, notes)
    VALUES (p_user_id, p_name, p_category, p_total_amount, p_remaining_amount, p_interest_rate, p_monthly_payment, p_due_date, p_notes)
    RETURNING id INTO v_liability_id;

    -- Handle account credit (loan received) if account provided
    IF p_account_id IS NOT NULL AND p_total_amount > 0 THEN
        SELECT balance, name INTO v_old_bal, v_acc_name FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;

        UPDATE accounts SET balance = balance + p_total_amount WHERE id = p_account_id;

        v_log_id := gen_random_uuid();
        v_txn_id := gen_random_uuid();

        INSERT INTO ledger_logs (id, user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details, source_id, source_type)
        VALUES (v_log_id, p_user_id, p_account_id, v_acc_name, 'ADJUST_UP', p_total_amount, v_old_bal, v_old_bal + p_total_amount, 'Loan Disbursement: ' || p_name, v_liability_id, 'liability');

        INSERT INTO transactions (id, user_id, account_id, description, amount, type, category, date, source_id, source_type, ledger_log_id)
        VALUES (v_txn_id, p_user_id, p_account_id, 'Loan Disbursement: ' || p_name, p_total_amount, 'income', 'Loans', CURRENT_DATE, v_liability_id, 'liability', v_log_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'liability_id', v_liability_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;


-- ============================================================================
-- 7. CLEANUP: Drop old function overloads + permission hardening
-- ============================================================================

-- 7a. Drop old 4-param adjust_account_balance overload (only if 6-param version exists)
DO $$ 
BEGIN
    -- Only drop 4-param if the 6-param version exists (to avoid breaking things)
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        WHERE p.proname = 'adjust_account_balance' 
        AND p.pronamespace = 'public'::regnamespace 
        AND p.pronargs = 6
    ) THEN
        DROP FUNCTION IF EXISTS public.adjust_account_balance(UUID, UUID, NUMERIC, TEXT);
    END IF;
END $$;

-- 7b. Dynamic permission hardening for all public schema functions
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        WHERE p.pronamespace = 'public'::regnamespace
          AND p.proname IN (
              'update_forex_trade_atomic',
              'add_alternative_asset_atomic',
              'add_liability_atomic',
              'fno_log_trade',
              'fno_close_position',
              'fno_delete_trade',
              'set_updated_at',
              'get_investments_v1'
          )
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
          )
    ) LOOP
        BEGIN
            EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM public;';
            EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.sig || ' FROM anon;';
            EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.sig || ' TO authenticated, service_role;';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping permission for %: %', r.sig, SQLERRM;
        END;
    END LOOP;
END $$;

