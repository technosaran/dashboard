
-- Grant access to authenticated users for the reset function
GRANT EXECUTE ON FUNCTION reset_user_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_user_data(UUID) TO service_role;
