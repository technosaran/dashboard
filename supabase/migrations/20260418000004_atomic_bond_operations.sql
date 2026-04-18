-- Atomic bond purchase RPC - ensures bond creation, transaction recording,
-- account deduction, and ledger logging all happen atomically.

CREATE OR REPLACE FUNCTION record_bond_purchase(
    p_user_id UUID,
    p_bond_name TEXT,
    p_isin TEXT,
    p_issuer TEXT,
    p_bond_type TEXT,
    p_face_value DECIMAL,
    p_quantity INTEGER,
    p_purchase_price DECIMAL,
    p_current_price DECIMAL,
    p_coupon_rate DECIMAL,
    p_ytm DECIMAL DEFAULT NULL,
    p_purchase_date DATE DEFAULT CURRENT_DATE,
    p_maturity_date DATE DEFAULT NULL,
    p_next_interest_date DATE DEFAULT NULL,
    p_interest_frequency TEXT DEFAULT 'Semi-Annual',
    p_credit_rating TEXT DEFAULT NULL,
    p_platform TEXT DEFAULT 'Wint',
    p_demat_account TEXT DEFAULT NULL,
    p_account_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_total_invested DECIMAL;
    v_current_value DECIMAL;
    v_bond_id UUID;
    v_account_balance DECIMAL;
    v_account_name TEXT;
BEGIN
    v_total_invested := p_purchase_price * p_quantity;
    v_current_value := p_current_price * p_quantity;

    -- Insert the bond
    INSERT INTO public.bonds (
        user_id, bond_name, isin, issuer, bond_type,
        face_value, quantity, purchase_price, current_price,
        total_invested, current_value, coupon_rate, ytm,
        purchase_date, maturity_date, next_interest_date,
        interest_frequency, credit_rating, platform, demat_account, notes
    ) VALUES (
        p_user_id, p_bond_name, p_isin, p_issuer, p_bond_type,
        p_face_value, p_quantity, p_purchase_price, p_current_price,
        v_total_invested, v_current_value, p_coupon_rate, p_ytm,
        p_purchase_date, p_maturity_date, p_next_interest_date,
        p_interest_frequency, p_credit_rating, p_platform, p_demat_account, p_notes
    ) RETURNING id INTO v_bond_id;

    -- Record the buy transaction (linked to bond)
    INSERT INTO public.bond_transactions (
        user_id, bond_id, transaction_type, transaction_date,
        quantity, price_per_bond, amount, account_id
    ) VALUES (
        p_user_id, v_bond_id, 'BUY', p_purchase_date,
        p_quantity, p_purchase_price, v_total_invested, p_account_id
    );

    -- Deduct from account if specified
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_account_balance, v_account_name
        FROM public.accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF v_account_balance IS NULL THEN
            RAISE EXCEPTION 'Account not found';
        END IF;

        IF v_account_balance < v_total_invested THEN
            RAISE EXCEPTION 'Insufficient balance (Available: %, Required: %)', v_account_balance, v_total_invested;
        END IF;

        UPDATE public.accounts
        SET balance = balance - v_total_invested
        WHERE id = p_account_id AND user_id = p_user_id;

        INSERT INTO public.ledger_logs (
            user_id, account_id, account_name, action_type,
            amount, previous_balance, new_balance, details
        ) VALUES (
            p_user_id, p_account_id, v_account_name, 'ADJUST_DOWN',
            v_total_invested, v_account_balance, v_account_balance - v_total_invested,
            'Purchased ' || p_quantity || ' units of ' || p_bond_name || ' (' || p_isin || ')'
        );
    END IF;

    RETURN json_build_object('success', true, 'bond_id', v_bond_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Atomic interest payment recording
CREATE OR REPLACE FUNCTION record_bond_interest(
    p_user_id UUID,
    p_bond_id UUID,
    p_amount DECIMAL,
    p_payment_date DATE,
    p_period_start DATE,
    p_period_end DATE,
    p_account_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_account_balance DECIMAL;
    v_account_name TEXT;
BEGIN
    -- Record transaction
    INSERT INTO public.bond_transactions (
        user_id, bond_id, transaction_type, transaction_date,
        amount, interest_amount, interest_period_start, interest_period_end, account_id
    ) VALUES (
        p_user_id, p_bond_id, 'INTEREST', p_payment_date,
        p_amount, p_amount, p_period_start, p_period_end, p_account_id
    );

    -- Update bond total interest earned
    UPDATE public.bonds
    SET total_interest_earned = COALESCE(total_interest_earned, 0) + p_amount,
        accrued_interest = 0
    WHERE id = p_bond_id AND user_id = p_user_id;

    -- Credit to account if specified
    IF p_account_id IS NOT NULL THEN
        SELECT balance, name INTO v_account_balance, v_account_name
        FROM public.accounts
        WHERE id = p_account_id AND user_id = p_user_id
        FOR UPDATE;

        IF v_account_balance IS NOT NULL THEN
            UPDATE public.accounts
            SET balance = balance + p_amount
            WHERE id = p_account_id AND user_id = p_user_id;

            INSERT INTO public.ledger_logs (
                user_id, account_id, account_name, action_type,
                amount, previous_balance, new_balance, details
            ) VALUES (
                p_user_id, p_account_id, v_account_name, 'ADJUST_UP',
                p_amount, v_account_balance, v_account_balance + p_amount,
                'Bond interest payment received'
            );
        END IF;
    END IF;

    RETURN json_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
