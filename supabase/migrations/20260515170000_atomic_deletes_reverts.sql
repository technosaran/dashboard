-- Migration: 20260515170000_atomic_deletes_reverts.sql
-- Purpose: Ensures that deleting entities like liabilities, alternative assets, forex accounts, etc.,
-- is fully atomic by automatically finding the associated ledger logs, reverting them to refund balances,
-- and cleaning up the entity, preventing orphaned financial records and out-of-sync balances.

CREATE OR REPLACE FUNCTION atomic_delete_entity(
    p_user_id UUID,
    p_entity_type TEXT,
    p_entity_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_log_id UUID;
    v_res JSONB;
BEGIN
    IF p_user_id IS NULL OR (auth.role() = 'authenticated' AND p_user_id != auth.uid()) THEN 
        RAISE EXCEPTION 'Unauthorized'; 
    END IF;

    -- Loop through all associated ledger logs where this entity is the source, in reverse chronological order
    FOR v_log_id IN 
        SELECT id FROM ledger_logs 
        WHERE source_id = p_entity_id AND source_type = p_entity_type AND user_id = p_user_id
        ORDER BY created_at DESC 
    LOOP
        v_res := revert_ledger_log(v_log_id, p_user_id);
    END LOOP;

    -- After reverting all financial transactions, safely delete the entity record itself
    IF p_entity_type = 'alternative_asset' THEN
        DELETE FROM alternative_assets WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'liability' THEN
        DELETE FROM liabilities WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'forex_account' THEN
        DELETE FROM forex_accounts WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'investment' THEN
        DELETE FROM investments WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'goal' THEN
        DELETE FROM goals WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'recipient' THEN
        DELETE FROM recipients WHERE id = p_entity_id AND user_id = p_user_id;
    ELSIF p_entity_type = 'budget' THEN
        DELETE FROM budgets WHERE id = p_entity_id AND user_id = p_user_id;
    END IF;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
