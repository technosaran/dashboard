import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://hfbhkfllkvgxikjspemk.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhmYmhrZmxsa3ZneGlranNwZW1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ3MzA2MCwiZXhwIjoyMDkxMDQ5MDYwfQ.nmgeQQyvcPZyV4gda6D3wJGhx-JExt8vGkvwfjPZmu0";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function run() {
  // Step 1: Create the table using raw SQL via the rpc
  // Since we can't run raw SQL directly, let's try to use the admin API
  // Let's first check if the table exists
  const { data, error } = await supabase.from('investments').select('id').limit(1);
  
  if (error && error.message.includes('investments')) {
    console.log('Table does not exist. Creating via SQL...');
    
    // Try the SQL query endpoint
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    console.log('REST root:', response.status);
    
    // Try using the database directly via a temporary function
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.investments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        symbol TEXT,
        quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
        buy_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
        current_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'INR',
        notes TEXT,
        bought_at DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
    `;
    
    // Create a temporary function to run our SQL
    const { data: funcData, error: funcError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (funcError) {
      console.log('exec_sql not available:', funcError.message);
      console.log('\n========================================');
      console.log('MANUAL STEP REQUIRED:');
      console.log('========================================');
      console.log('Please go to your Supabase Dashboard SQL Editor:');
      console.log('https://supabase.com/dashboard/project/hfbhkfllkvgxikjspemk/sql/new');
      console.log('\nAnd run this SQL:\n');
      console.log(`CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('stock', 'mutual_fund', 'gold', 'crypto', 'bond', 'fixed_deposit', 'other')),
  symbol TEXT,
  quantity NUMERIC(18, 6) NOT NULL DEFAULT 0,
  buy_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  current_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  notes TEXT,
  bought_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own investments" ON investments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_type ON investments(user_id, type);`);
    } else {
      console.log('✅ Table created successfully!', funcData);
    }
  } else {
    console.log('✅ Table already exists!', data);
  }
}

run().catch(console.error);
