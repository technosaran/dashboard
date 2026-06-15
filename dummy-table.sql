-- Drop the table if it already exists
DROP TABLE IF EXISTS dummy_test;

-- Create the dummy table
CREATE TABLE dummy_test (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    name TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    amount NUMERIC(12, 2) DEFAULT 0.00,
    is_completed BOOLEAN DEFAULT false,
    user_id UUID DEFAULT auth.uid()
);

-- Enable Row-Level Security (RLS)
ALTER TABLE dummy_test ENABLE ROW LEVEL SECURITY;

-- Create a security policy allowing users to manage their own records
CREATE POLICY "Allow users to manage their own dummy records" 
ON dummy_test
FOR ALL 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Insert sample data
INSERT INTO dummy_test (name, category, amount, is_completed)
VALUES 
    ('Test Record Alpha', 'Analytics', 1250.50, false),
    ('Test Record Beta', 'Operations', 450.00, true),
    ('Test Record Gamma', 'Marketing', 0.00, false);
