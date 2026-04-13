-- DB Audit Helpers
CREATE OR REPLACE FUNCTION audit_get_schemas()
RETURNS TABLE (schema_name TEXT) AS $$
BEGIN
    RETURN QUERY SELECT s.schema_name::TEXT FROM information_schema.schemata s 
    WHERE s.schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
    ORDER BY s.schema_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION audit_get_tables()
RETURNS TABLE (table_name TEXT, row_count BIGINT) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        t.table_name::TEXT,
        (xpath('/row/cnt/text()', query_to_xml(format('select count(*) as cnt from %I.%I', t.table_schema, t.table_name), false, true, '')))[1]::text::bigint
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION audit_get_indexes()
RETURNS TABLE (table_name TEXT, index_name TEXT, index_definition TEXT) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        t.relname::TEXT as table_name,
        i.relname::TEXT as index_name,
        pg_get_indexdef(indexrelid)::TEXT as index_definition
    FROM pg_stat_all_indexes i
    JOIN pg_class t ON i.relid = t.oid
    WHERE i.schemaname = 'public'
    ORDER BY t.relname, i.relname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
