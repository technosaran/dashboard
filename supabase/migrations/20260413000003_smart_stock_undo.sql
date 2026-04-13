
-- Migration: Enhanced Stocks Logic (Realized P&L and Smart Reversion)
-- Adds realized_pnl tracking and improves the Undo mechanism.

-- 1. Add realized_pnl to investments table to track booked profits
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC(14, 2) DEFAULT 0;

-- 2. Update revert_ledger_log to handle 'stock_trade' type
-- This will correctly reverse a specific trade's impact on a holding
CREATE OR REPLACE FUNCTION revert_ledger_log(
    p_log_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_log RECORD;
    v_trade RECORD;
    v_investment RECORD;
    v_new_qty NUMERIC;
    v_new_avg NUMERIC;
    v_new_pnl NUMERIC;
BEGIN
    -- 1. Get the log entry
    SELECT * INTO v_log FROM ledger_logs WHERE id = p_log_id AND user_id = p_user_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Log entry not found'); END IF;

    -- 2. Reverse the bank account balance
    UPDATE accounts 
    SET balance = v_log.previous_balance 
    WHERE id = v_log.account_id AND user_id = p_user_id;

    -- 3. Delete the transaction record (find by details or amount/date)
    -- We'll assume a clean delete based on the source_id/type if possible
    DELETE FROM transactions 
    WHERE user_id = p_user_id 
      AND account_id = v_log.account_id 
      AND created_at >= (v_log.created_at - interval '5 seconds')
      AND created_at <= (v_log.created_at + interval '5 seconds')
      AND amount = v_log.amount;

    -- 4. Deep Reversal for Stocks
    IF v_log.source_type = 'stock_trade' THEN
        -- Get the specific trade details
        SELECT * INTO v_trade FROM stock_trades WHERE id = v_log.source_id AND user_id = p_user_id;
        
        IF FOUND THEN
            -- Get the current holding state
            SELECT * INTO v_investment FROM investments WHERE symbol = v_trade.symbol AND user_id = p_user_id;
            
            IF FOUND THEN
                IF v_trade.trade_type = 'buy' THEN
                    -- REVERSING A BUY: Subtract qty, recalculate previous average
                    -- Total Cost = (Cur Qty * Cur Avg) - (Trade Qty * Trade Price)
                    -- Prev Qty = Cur Qty - Trade Qty
                    v_new_qty := v_investment.quantity - v_trade.quantity;
                    IF v_new_qty > 0 THEN
                        v_new_avg := ((v_investment.quantity * v_investment.buy_price) - (v_trade.quantity * v_trade.price)) / v_new_qty;
                        UPDATE investments SET quantity = v_new_qty, buy_price = v_new_avg WHERE id = v_investment.id;
                    ELSE
                        DELETE FROM investments WHERE id = v_investment.id;
                    END IF;
                ELSE
                    -- REVERSING A SELL: Add qty back, realized_pnl subtraction
                    v_new_qty := v_investment.quantity + v_trade.quantity;
                    -- Re-calculate realized P&L: subtract the profit booked by this trade
                    -- P&L was: (Sell Price - Holding Avg Price) * Qty
                    -- We use the trade's total amount and historical context
                    v_new_pnl := v_investment.realized_pnl - (v_trade.total_amount - (v_trade.quantity * v_investment.buy_price));
                    UPDATE investments SET quantity = v_new_qty, realized_pnl = v_new_pnl WHERE id = v_investment.id;
                END IF;
            END IF;
            
            -- Delete the trade history record
            DELETE FROM stock_trades WHERE id = v_trade.id;
        END IF;
    END IF;

    -- 5. Final cleanup of the log itself
    DELETE FROM ledger_logs WHERE id = p_log_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
