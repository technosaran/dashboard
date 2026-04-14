
-- Migration: Sophisticated Backend Integrity
-- Purpose: Final hardening of all financial RPCs with explicit ID linking and precise reversal logic.

-- IMPORTANT: Drop functions first to avoid "cannot remove parameter defaults" errors
DROP FUNCTION IF EXISTS record_income(UUID, TEXT, NUMERIC, TEXT, DATE, UUID);
DROP FUNCTION IF EXISTS record_expense(UUID, TEXT, NUMERIC, TEXT, DATE, UUID);
DROP FUNCTION IF EXISTS process_family_transfer(UUID, UUID, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS record_investment(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS record_investment(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, DATE, UUID, NUMERIC, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS revert_ledger_log(UUID, UUID);
DROP FUNCTION IF EXISTS adjust_account_balance(UUID, UUID, NUMERIC, TEXT);

-- 1. Updated record_income
CREATE OR REPLACE FUNCTION record_income(
    p_user_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC := 0;
    v_new_balance NUMERIC := 0;
    v_account_name TEXT := 'Suspense (Direct Log)';
    v_income_id UUID;
    v_log_id UUID;
    v_transaction_id UUID;
BEGIN
    -- 1. Insert into incomes table FIRST
    INSERT INTO incomes (
        user_id, account_id, description, amount, category, date
    ) VALUES (
        p_user_id, p_account_id, p_description, p_amount, p_category, p_date
    ) RETURNING id INTO v_income_id;

    -- 2. Handle Balance logic if account is provided
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Account not found or access denied';
        END IF;

        v_new_balance := v_old_balance + p_amount;
        UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;
    ELSE
        v_new_balance := p_amount;
    END IF;

    -- 3. ALWAYS Log to ledger_logs
    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_type, source_id
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 'ADJUST_UP', 
        p_amount, v_old_balance, v_new_balance, 
        'Income: ' || p_description || ' (' || p_category || ')',
        'income', v_income_id
    ) RETURNING id INTO v_log_id;

    -- 4. Log to transactions table if account is linked
    IF p_account_id IS NOT NULL THEN
        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date,
            source_id, source_type, ledger_log_id
        ) VALUES (
            p_user_id, p_account_id, p_description, p_amount, 'income', p_category, p_date,
            v_income_id, 'income', v_log_id
        ) RETURNING id INTO v_transaction_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'income_id', v_income_id, 'log_id', v_log_id, 'transaction_id', v_transaction_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Updated record_expense
CREATE OR REPLACE FUNCTION record_expense(
    p_user_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC := 0;
    v_new_balance NUMERIC := 0;
    v_account_name TEXT := 'Cash / Suspense';
    v_expense_id UUID;
    v_log_id UUID;
    v_transaction_id UUID;
BEGIN
    -- 1. Insert into expenses table FIRST
    INSERT INTO expenses (
        user_id, account_id, description, amount, category, date
    ) VALUES (
        p_user_id, p_account_id, p_description, p_amount, p_category, p_date
    ) RETURNING id INTO v_expense_id;

    -- 2. Handle Balance logic if account is provided
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Account not found or access denied';
        END IF;

        IF v_old_balance < p_amount THEN
            RAISE EXCEPTION 'Insufficient balance in %', v_account_name;
        END IF;

        v_new_balance := v_old_balance - p_amount;
        UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;
    ELSE
        v_new_balance := -p_amount;
    END IF;

    -- 3. ALWAYS Log to ledger_logs
    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_type, source_id
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 'ADJUST_DOWN', 
        p_amount, v_old_balance, v_new_balance, 
        'Expense: ' || p_description || ' (' || p_category || ')',
        'expense', v_expense_id
    ) RETURNING id INTO v_log_id;

    -- 4. Log to transactions table if account is linked
    IF p_account_id IS NOT NULL THEN
        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date,
            source_id, source_type, ledger_log_id
        ) VALUES (
            p_user_id, p_account_id, p_description, p_amount, 'expense', p_category, p_date,
            v_expense_id, 'expense', v_log_id
        ) RETURNING id INTO v_transaction_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'expense_id', v_expense_id, 'log_id', v_log_id, 'transaction_id', v_transaction_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Updated record_investment (Super-Hardened)
CREATE OR REPLACE FUNCTION record_investment(
    p_user_id UUID,
    p_name TEXT,
    p_type TEXT,
    p_symbol TEXT,
    p_quantity NUMERIC,
    p_buy_price NUMERIC,
    p_current_price NUMERIC,
    p_currency TEXT,
    p_notes TEXT,
    p_date DATE,
    p_account_id UUID,
    p_total_cost NUMERIC,
    p_trade_type TEXT,
    p_charges NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_investment_id UUID;
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_action_type TEXT;
    v_existing_holding RECORD;
    v_new_qty NUMERIC;
    v_new_avg_price NUMERIC;
    v_profit NUMERIC := 0;
    v_log_id UUID;
BEGIN
    -- 1. Check for existing holding
    SELECT * INTO v_existing_holding FROM investments 
    WHERE user_id = p_user_id AND symbol = p_symbol AND type = p_type;

    -- 2. Calculate New State
    IF p_trade_type = 'buy' THEN
        IF v_existing_holding IS NOT NULL THEN
            v_new_qty := v_existing_holding.quantity + p_quantity;
            -- If new_qty is 0 (shouldn't happen on buy, but safety first), avoid div zero
            IF v_new_qty > 0 THEN
                v_new_avg_price := ((v_existing_holding.quantity * v_existing_holding.buy_price) + (p_quantity * p_buy_price)) / v_new_qty;
            ELSE
                v_new_avg_price := p_buy_price;
            END IF;
            
            UPDATE investments SET 
                quantity = v_new_qty,
                buy_price = v_new_avg_price,
                current_price = p_current_price,
                updated_at = NOW(),
                notes = COALESCE(p_notes, notes)
            WHERE id = v_existing_holding.id;
            v_investment_id := v_existing_holding.id;
        ELSE
            INSERT INTO investments (
                user_id, name, type, symbol, quantity, buy_price, current_price, currency, notes, bought_at
            ) VALUES (
                p_user_id, p_name, p_type, p_symbol, p_quantity, p_buy_price, p_current_price, p_currency, p_notes, p_date
            ) RETURNING id INTO v_investment_id;
        END IF;
    ELSE
        -- SELL LOGIC
        IF v_existing_holding IS NULL THEN
            RAISE EXCEPTION 'You do not own this stock to sell it.';
        END IF;

        IF v_existing_holding.quantity < p_quantity THEN
            RAISE EXCEPTION 'Insufficient quantity to sell. You have % units.', v_existing_holding.quantity;
        END IF;

        v_new_qty := v_existing_holding.quantity - p_quantity;
        v_profit := (p_buy_price - v_existing_holding.buy_price) * p_quantity;

        UPDATE investments SET 
            quantity = v_new_qty,
            realized_pnl = COALESCE(realized_pnl, 0) + v_profit,
            current_price = p_current_price,
            updated_at = NOW()
        WHERE id = v_existing_holding.id;
        v_investment_id := v_existing_holding.id;
    END IF;

    -- 3. Handle Fund Movement if account is provided
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_old_balance, v_account_name
        FROM accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Deduction account not found';
        END IF;

        IF p_trade_type = 'buy' THEN
            IF v_old_balance < p_total_cost THEN
                RAISE EXCEPTION 'Insufficient balance in %. Required: ₹%, Available: ₹%', v_account_name, p_total_cost, v_old_balance;
            END IF;
            v_new_balance := v_old_balance - p_total_cost;
            v_action_type := 'ADJUST_DOWN';
        ELSE
            v_new_balance := v_old_balance + p_total_cost;
            v_action_type := 'ADJUST_UP';
        END IF;

        UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

        -- Log to ledger_logs FIRST to get log_id
        INSERT INTO ledger_logs (
            user_id, account_id, account_name, action_type, 
            amount, previous_balance, new_balance, details,
            source_id, source_type
        ) VALUES (
            p_user_id, p_account_id, v_account_name, v_action_type, 
            p_total_cost, v_old_balance, v_new_balance, 
            (CASE WHEN p_trade_type = 'buy' THEN 'Bought ' ELSE 'Sold ' END) || p_quantity || ' units of ' || p_symbol || ' (Net: ₹' || p_total_cost || ')',
            v_investment_id, 'investment'
        ) RETURNING id INTO v_log_id;

        -- Log to transactions table WITH log_id and source linkage
        INSERT INTO transactions (
            user_id, account_id, description, amount, type, category, date,
            source_id, source_type, ledger_log_id
        ) VALUES (
            p_user_id, p_account_id, 
            (CASE WHEN p_trade_type = 'buy' THEN 'Purchase ' ELSE 'Sale ' END) || p_name || ' (' || p_symbol || ')',
            p_total_cost, 
            CASE WHEN p_trade_type = 'buy' THEN 'expense' ELSE 'income' END,
            'Investments', p_date,
            v_investment_id, 'investment', v_log_id
        );
    END IF;

    -- 4. Record the specific trade in trade history
    INSERT INTO stock_trades (
        user_id, investment_id, symbol, trade_type, quantity, price, total_amount, trade_date, exchange, charges
    ) VALUES (
        p_user_id, v_investment_id, p_symbol, p_trade_type, p_quantity, p_buy_price, p_total_cost, p_date,
        CASE WHEN p_symbol LIKE '%.BO' THEN 'BSE' ELSE 'NSE' END,
        p_charges
    );

    RETURN jsonb_build_object('success', true, 'investment_id', v_investment_id, 'profit', v_profit, 'log_id', v_log_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. ULTRA-HARDENED revert_ledger_log
-- Purpose: ELIMINATE all fuzzy matching. Use explicit IDs for source cleanup.
CREATE OR REPLACE FUNCTION revert_ledger_log(
    p_log_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_log RECORD;
    v_other_log RECORD;
    v_current_balance NUMERIC;
    v_rev_amount NUMERIC;
    v_new_balance NUMERIC;
    v_meta JSONB;
BEGIN
    -- 1. Fetch log and lock it
    SELECT * INTO v_log FROM ledger_logs 
    WHERE id = p_log_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Log entry not found or access denied');
    END IF;

    -- 2. Handle CRUD Operations (Creation/Deletion)
    IF v_log.action_type = 'CREATE' THEN
         IF EXISTS (SELECT 1 FROM transactions WHERE account_id = v_log.account_id LIMIT 1) THEN
              RETURN jsonb_build_object('success', false, 'error', 'Cannot undo account creation: Existing transactions detected.');
         END IF;
         DELETE FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id;
         DELETE FROM ledger_logs WHERE id = p_log_id;
         RETURN jsonb_build_object('success', true);

    ELSIF v_log.action_type = 'DELETE' THEN
        v_meta := v_log.metadata;
        IF v_meta IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM accounts WHERE id = (v_meta->>'id')::UUID) THEN
                RETURN jsonb_build_object('success', false, 'error', 'Account already exists.');
            END IF;

            INSERT INTO accounts (
                id, user_id, name, type, balance, currency, bank_name, created_at
            ) VALUES (
                (v_meta->>'id')::UUID, (v_meta->>'user_id')::UUID, v_meta->>'name', v_meta->>'type',
                (v_meta->>'balance')::NUMERIC, COALESCE(v_meta->>'currency', 'INR'), v_meta->>'bank_name',
                (v_meta->>'created_at')::TIMESTAMPTZ
            );
            DELETE FROM ledger_logs WHERE id = p_log_id;
            RETURN jsonb_build_object('success', true);
        END IF;
    END IF;

    -- 3. Handle Balance Reversal (Unified logic)
    IF v_log.account_id IS NOT NULL AND v_log.amount IS NOT NULL THEN
        SELECT balance INTO v_current_balance FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;

        IF FOUND THEN
            -- Reverse the sign based on action type
            IF v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY') THEN
                v_rev_amount := v_log.amount; -- Refund
            ELSIF v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN', 'SEND_MONEY_IN') THEN
                v_rev_amount := -v_log.amount; -- Charge back
            ELSE
                v_rev_amount := 0;
            END IF;

            IF v_rev_amount != 0 THEN
                UPDATE accounts SET balance = v_current_balance + v_rev_amount WHERE id = v_log.account_id;
                
                -- Log the reversal itself for audit trail
                INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
                VALUES (p_user_id, v_log.account_id, v_log.account_name, 
                       CASE WHEN v_rev_amount > 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
                       ABS(v_rev_amount), v_current_balance, v_current_balance + v_rev_amount, 'REVERSAL OF: ' || v_log.details);
            END IF;
        END IF;
    END IF;

    -- 4. Deep Cleanup for individual sources (NO MORE FUZZY MATCHING)
    IF v_log.source_id IS NOT NULL THEN
        -- Delete from transactions using ledger_log_id (PRECISE)
        DELETE FROM transactions WHERE ledger_log_id = p_log_id AND user_id = p_user_id;
        
        -- If it was a transfer, handle both sides
        IF v_log.source_type = 'transfer' THEN
            FOR v_other_log IN SELECT * FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id AND user_id = p_user_id LOOP
                SELECT balance INTO v_current_balance FROM accounts WHERE id = v_other_log.account_id AND user_id = p_user_id FOR UPDATE;
                IF FOUND THEN
                    v_rev_amount := CASE WHEN v_other_log.action_type = 'TRANSFER_OUT' THEN v_other_log.amount ELSE -v_other_log.amount END;
                    UPDATE accounts SET balance = v_current_balance + v_rev_amount WHERE id = v_other_log.account_id;
                    
                    INSERT INTO ledger_logs (user_id, account_id, account_name, action_type, amount, previous_balance, new_balance, details)
                    VALUES (p_user_id, v_other_log.account_id, v_other_log.account_name, 
                           CASE WHEN v_rev_amount > 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
                           ABS(v_rev_amount), v_current_balance, v_current_balance + v_rev_amount, 'REVERSAL OF TRANSFER SIDE: ' || v_other_log.details);
                END IF;
            END LOOP;
            DELETE FROM transfers WHERE id = v_log.source_id AND user_id = p_user_id;
            DELETE FROM ledger_logs WHERE source_id = v_log.source_id AND user_id = p_user_id;

        ELSIF v_log.source_type = 'income' THEN
            DELETE FROM incomes WHERE id = v_log.source_id AND user_id = p_user_id;
        
        ELSIF v_log.source_type = 'expense' THEN
            DELETE FROM expenses WHERE id = v_log.source_id AND user_id = p_user_id;

        ELSIF v_log.source_type = 'investment' THEN
            DELETE FROM stock_trades WHERE investment_id = v_log.source_id AND total_amount = v_log.amount AND user_id = p_user_id;
        END IF;
    END IF;

    -- 5. Delete original log
    DELETE FROM ledger_logs WHERE id = p_log_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Updated process_family_transfer
CREATE OR REPLACE FUNCTION process_family_transfer(
    p_user_id UUID,
    p_account_id UUID,
    p_recipient_id UUID,
    p_amount NUMERIC,
    p_note TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_recipient_name TEXT;
    v_transaction_id UUID;
    v_details TEXT;
    v_log_id UUID;
BEGIN
    -- 1. Lock and validate account
    SELECT balance, name INTO v_old_balance, v_account_name
    FROM accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found';
    END IF;

    IF v_old_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- 2. Validate recipient
    SELECT name INTO v_recipient_name
    FROM recipients
    WHERE id = p_recipient_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Recipient not found';
    END IF;

    -- 3. Execute deduction
    v_new_balance := v_old_balance - p_amount;
    UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

    -- 4. Create details
    v_details := 'Sent money to ' || v_recipient_name || CASE WHEN p_note IS NOT NULL AND p_note != '' THEN ': ' || p_note ELSE '' END;
    
    -- 5. Log to Ledger FIRST to get log_id
    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_id, source_type
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 'SEND_MONEY', 
        p_amount, v_old_balance, v_new_balance, v_details,
        NULL, 'transaction'
    ) RETURNING id INTO v_log_id;

    -- 6. Create Transaction record linked to log_id
    INSERT INTO transactions (
        user_id, account_id, description, amount, type, category, date,
        source_type, ledger_log_id
    ) VALUES (
        p_user_id, p_account_id, v_details, p_amount, 'expense', 'Family & Friends', CURRENT_DATE,
        'family_transfer', v_log_id
    ) RETURNING id INTO v_transaction_id;

    -- 7. Update log with transaction_id as source_id
    UPDATE ledger_logs SET source_id = v_transaction_id WHERE id = v_log_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'log_id', v_log_id,
        'new_balance', v_new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Updated adjust_account_balance
CREATE OR REPLACE FUNCTION adjust_account_balance(
    p_user_id UUID,
    p_account_id UUID,
    p_amount NUMERIC,
    p_note TEXT
) RETURNS JSONB AS $$
DECLARE
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_transaction_id UUID;
    v_log_id UUID;
BEGIN
    SELECT balance, name INTO v_old_balance, v_account_name
    FROM accounts WHERE id = p_account_id AND user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;

    v_new_balance := v_old_balance + p_amount;
    IF v_new_balance < 0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    UPDATE accounts SET balance = v_new_balance WHERE id = p_account_id;

    INSERT INTO ledger_logs (
        user_id, account_id, account_name, action_type, 
        amount, previous_balance, new_balance, details,
        source_type
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 
        CASE WHEN p_amount > 0 THEN 'ADJUST_UP' ELSE 'ADJUST_DOWN' END,
        ABS(p_amount), v_old_balance, v_new_balance, 
        COALESCE(p_note, 'Manual balance adjustment'),
        'transaction'
    ) RETURNING id INTO v_log_id;

    INSERT INTO transactions (
        user_id, account_id, description, amount, type, date,
        ledger_log_id, source_type
    ) VALUES (
        p_user_id, p_account_id, COALESCE(p_note, 'Balance adjustment'), ABS(p_amount), 
        CASE WHEN p_amount > 0 THEN 'income' ELSE 'expense' END,
        CURRENT_DATE, v_log_id, 'adjustment'
    ) RETURNING id INTO v_transaction_id;

    UPDATE ledger_logs SET source_id = v_transaction_id WHERE id = v_log_id;

    RETURN jsonb_build_object('success', true, 'log_id', v_log_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
