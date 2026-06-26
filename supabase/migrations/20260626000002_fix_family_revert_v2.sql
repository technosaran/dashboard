-- Migration: Fix Family Revert and Link Transactions
-- Date: 2026-06-26

-- 1. Redefine process_family_transfer_v2 to link ledger_logs via source_id
CREATE OR REPLACE FUNCTION public.process_family_transfer_v2(
    p_user_id UUID,
    p_family_member_id UUID,
    p_account_id UUID,
    p_amount NUMERIC,
    p_type TEXT,
    p_note TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_member_name TEXT;
    v_details TEXT;
    v_transfer_id UUID;
BEGIN
    -- Validate amount
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than zero';
    END IF;

    -- Lock and validate the bank account
    SELECT balance, name INTO v_old_balance, v_account_name
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found';
    END IF;

    IF v_old_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Validate the family member
    SELECT name INTO v_member_name
    FROM public.family_members
    WHERE id = p_family_member_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family member not found';
    END IF;

    -- Deduct from bank account
    v_new_balance := v_old_balance - p_amount;
    UPDATE public.accounts
    SET balance = v_new_balance
    WHERE id = p_account_id;

    -- Credit family member balance
    UPDATE public.family_members
    SET balance = balance + p_amount
    WHERE id = p_family_member_id AND user_id = p_user_id;

    -- Generate transfer ID
    v_transfer_id := gen_random_uuid();

    -- Record the transfer
    v_details := 'Family transfer to ' || v_member_name
        || CASE WHEN p_note IS NOT NULL AND p_note != '' THEN ': ' || p_note ELSE '' END;

    INSERT INTO public.family_transfers (
        id, user_id, family_member_id, account_id, amount, type, note
    ) VALUES (
        v_transfer_id, p_user_id, p_family_member_id, p_account_id, p_amount, p_type, p_note
    );

    -- Log to ledger (saving source_id and source_type)
    INSERT INTO public.ledger_logs (
        user_id, account_id, account_name, action_type,
        amount, previous_balance, new_balance, details, source_id, source_type
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 'ADJUST_DOWN',
        p_amount, v_old_balance, v_new_balance, v_details, v_transfer_id, 'family_transfer'
    );

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. Redefine pay_family_allowance to link ledger_logs via source_id
CREATE OR REPLACE FUNCTION public.pay_family_allowance(
    p_user_id UUID,
    p_allowance_id UUID,
    p_account_id UUID
) RETURNS JSON AS $$
DECLARE
    v_allowance RECORD;
    v_old_balance NUMERIC;
    v_new_balance NUMERIC;
    v_account_name TEXT;
    v_member_name TEXT;
    v_details TEXT;
    v_transfer_id UUID;
BEGIN
    -- Fetch the allowance
    SELECT * INTO v_allowance
    FROM public.family_allowances
    WHERE id = p_allowance_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Allowance not found';
    END IF;

    -- Get the family member name
    SELECT name INTO v_member_name
    FROM public.family_members
    WHERE id = v_allowance.family_member_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Family member not found';
    END IF;

    -- Lock and validate the bank account
    SELECT balance, name INTO v_old_balance, v_account_name
    FROM public.accounts
    WHERE id = p_account_id AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found';
    END IF;

    IF v_old_balance < v_allowance.amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Deduct from bank account
    v_new_balance := v_old_balance - v_allowance.amount;
    UPDATE public.accounts
    SET balance = v_new_balance
    WHERE id = p_account_id;

    -- Credit family member balance
    UPDATE public.family_members
    SET balance = balance + v_allowance.amount
    WHERE id = v_allowance.family_member_id AND user_id = p_user_id;

    -- Generate transfer ID
    v_transfer_id := gen_random_uuid();

    -- Record the transfer
    v_details := 'Allowance payment to ' || v_member_name
        || ' (' || v_allowance.frequency || ')';

    INSERT INTO public.family_transfers (
        id, user_id, family_member_id, account_id, amount, type, note
    ) VALUES (
        v_transfer_id, p_user_id, v_allowance.family_member_id, p_account_id,
        v_allowance.amount, 'allowance', v_details
    );

    -- Log to ledger (saving source_id and source_type)
    INSERT INTO public.ledger_logs (
        user_id, account_id, account_name, action_type,
        amount, previous_balance, new_balance, details, source_id, source_type
    ) VALUES (
        p_user_id, p_account_id, v_account_name, 'ADJUST_DOWN',
        v_allowance.amount, v_old_balance, v_new_balance, v_details, v_transfer_id, 'family_transfer'
    );

    -- Update last_paid_at on the allowance
    UPDATE public.family_allowances
    SET last_paid_at = NOW()
    WHERE id = p_allowance_id AND user_id = p_user_id;

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 3. Redefine revert_ledger_log to support family_transfer
CREATE OR REPLACE FUNCTION revert_ledger_log(p_log_id UUID, p_user_id UUID) RETURNS JSONB AS $$
DECLARE 
    v_log RECORD; 
    v_sub RECORD; 
    v_trade RECORD; 
    v_mf_trade RECORD; 
    v_bond_trade RECORD;
    v_forex_txn RECORD;
    v_item RECORD; 
    v_curr NUMERIC; 
    v_rev NUMERIC; 
    v_meta JSONB;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;

    SELECT * INTO v_log FROM ledger_logs WHERE id = p_log_id AND user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Log not found'); END IF;

    -- Module-specific logic based on source_type
    IF v_log.action_type = 'CREATE' THEN
         DELETE FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id;
    ELSIF v_log.action_type = 'DELETE' THEN
        v_meta := v_log.metadata;
        IF v_meta IS NOT NULL THEN
            INSERT INTO accounts (id, user_id, name, type, balance, color, institution, account_number, created_at)
            VALUES (
                (v_meta->>'id')::UUID, 
                (v_meta->>'user_id')::UUID, 
                v_meta->>'name', 
                v_meta->>'type', 
                (v_meta->>'balance')::NUMERIC, 
                v_meta->>'color', 
                v_meta->>'institution', 
                v_meta->>'account_number', 
                (v_meta->>'created_at')::TIMESTAMPTZ
            );
        END IF;
    ELSIF v_log.source_type = 'family_transfer' THEN
        SELECT * INTO v_sub FROM family_transfers WHERE id = v_log.source_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            UPDATE family_members SET balance = balance - v_sub.amount WHERE id = v_sub.family_member_id AND user_id = p_user_id;
            DELETE FROM family_transfers WHERE id = v_sub.id;
        END IF;
    ELSIF v_log.source_type = 'investment' THEN
        SELECT * INTO v_trade FROM stock_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM investments WHERE id = v_trade.investment_id AND user_id = p_user_id FOR UPDATE;
            IF v_trade.trade_type = 'buy' THEN
                UPDATE investments SET 
                    quantity = quantity - v_trade.quantity, 
                    buy_price = CASE WHEN (quantity - v_trade.quantity) > 0 THEN ((quantity * buy_price) - v_trade.total_amount) / (quantity - v_trade.quantity) ELSE 0 END,
                    updated_at = NOW()
                WHERE id = v_item.id;
            ELSE
                UPDATE investments SET 
                    quantity = quantity + v_trade.quantity, 
                    realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_trade.realized_pnl, 0),
                    updated_at = NOW()
                WHERE id = v_item.id;
            END IF;
            DELETE FROM stock_trades WHERE id = v_trade.id;
        END IF;
    ELSIF v_log.source_type = 'mutual_fund' THEN
        SELECT * INTO v_mf_trade FROM mutual_fund_trades WHERE ledger_log_id = p_log_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM mutual_funds WHERE id = v_mf_trade.mf_id AND user_id = p_user_id FOR UPDATE;
            IF v_mf_trade.trade_type = 'BUY' THEN
                UPDATE mutual_funds SET 
                    units = units - v_mf_trade.units, 
                    avg_nav = CASE WHEN (units - v_mf_trade.units) > 0 THEN ((units * avg_nav) - v_mf_trade.amount) / (units - v_mf_trade.units) ELSE 0 END,
                    updated_at = NOW()
                WHERE id = v_item.id;
            ELSE
                UPDATE mutual_funds SET 
                    units = units + v_mf_trade.units, 
                    realized_pnl = COALESCE(realized_pnl, 0) - COALESCE(v_mf_trade.units_reverted_pnl, 0), -- fallback safe
                    updated_at = NOW()
                WHERE id = v_item.id;
            END IF;
            DELETE FROM mutual_fund_trades WHERE id = v_mf_trade.id;
        END IF;
    ELSIF v_log.source_type = 'bond' THEN
        SELECT * INTO v_bond_trade FROM bond_transactions WHERE bond_id = v_log.source_id AND user_id = p_user_id AND (amount = v_log.amount OR interest_amount = v_log.amount) ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
        IF FOUND THEN
            SELECT * INTO v_item FROM bonds WHERE id = v_bond_trade.bond_id AND user_id = p_user_id FOR UPDATE;
            IF v_bond_trade.transaction_type = 'BUY' THEN
                UPDATE bonds SET 
                    quantity = quantity - v_bond_trade.quantity,
                    total_invested = total_invested - v_bond_trade.amount,
                    current_value = current_value - (v_item.current_price * v_bond_trade.quantity),
                    updated_at = NOW()
                WHERE id = v_item.id;
                IF (v_item.quantity - v_bond_trade.quantity) <= 0 THEN
                    DELETE FROM bonds WHERE id = v_item.id;
                END IF;
            ELSIF v_bond_trade.transaction_type = 'INTEREST' THEN
                UPDATE bonds SET 
                    total_interest_earned = COALESCE(total_interest_earned, 0) - v_bond_trade.interest_amount,
                    updated_at = NOW()
                WHERE id = v_item.id;
            END IF;
            DELETE FROM bond_transactions WHERE id = v_bond_trade.id;
        END IF;
    ELSIF v_log.source_type = 'forex' THEN
        SELECT * INTO v_forex_txn FROM forex_transactions WHERE id = v_log.source_id AND user_id = p_user_id FOR UPDATE;
        IF FOUND THEN
            IF v_forex_txn.transaction_type = 'DEPOSIT' THEN
                UPDATE forex_accounts SET 
                    balance = balance - v_forex_txn.amount,
                    total_deposited = total_deposited - v_forex_txn.amount,
                    updated_at = NOW()
                WHERE id = v_forex_txn.forex_account_id;
            ELSE
                UPDATE forex_accounts SET 
                    balance = balance + v_forex_txn.amount,
                    total_withdrawn = total_withdrawn - v_forex_txn.amount,
                    updated_at = NOW()
                WHERE id = v_forex_txn.forex_account_id;
            END IF;
            DELETE FROM forex_transactions WHERE id = v_forex_txn.id;
        END IF;
    ELSIF v_log.source_type = 'alternative_asset' THEN
        DELETE FROM alternative_assets WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'liability' THEN
        DELETE FROM liabilities WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'goal' THEN
        UPDATE goals SET current_amount = current_amount - v_log.amount, updated_at = NOW() WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'transfer' THEN
        FOR v_sub IN SELECT * FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id AND user_id = p_user_id LOOP
            UPDATE accounts SET balance = balance + (CASE WHEN v_sub.action_type = 'TRANSFER_OUT' THEN v_sub.amount ELSE -v_sub.amount END) WHERE id = v_sub.account_id AND user_id = p_user_id;
        END LOOP;
        DELETE FROM transfers WHERE id = v_log.source_id AND user_id = p_user_id;
        DELETE FROM ledger_logs WHERE source_id = v_log.source_id AND id != p_log_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'income' THEN DELETE FROM incomes WHERE id = v_log.source_id AND user_id = p_user_id;
    ELSIF v_log.source_type = 'expense' THEN DELETE FROM expenses WHERE id = v_log.source_id AND user_id = p_user_id;
    END IF;

    DELETE FROM transactions WHERE ledger_log_id = p_log_id AND user_id = p_user_id;

    -- Common account balance reversal
    SELECT balance INTO v_curr FROM accounts WHERE id = v_log.account_id AND user_id = p_user_id FOR UPDATE;
    IF FOUND THEN
        v_rev := CASE 
            WHEN v_log.action_type IN ('ADJUST_DOWN', 'TRANSFER_OUT', 'SEND_MONEY') THEN v_log.amount 
            WHEN v_log.action_type IN ('ADJUST_UP', 'TRANSFER_IN', 'SEND_MONEY_IN') THEN -v_log.amount 
            ELSE 0 
        END;
        IF v_rev != 0 THEN
            UPDATE accounts SET balance = balance + v_rev WHERE id = v_log.account_id;
        END IF;
    END IF;

    DELETE FROM ledger_logs WHERE id = p_log_id;
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
