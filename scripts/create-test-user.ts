import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const email = 'tester@example.com';
  const password = 'TesterPass!123';

  // Check if user exists
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("Error listing users:", listError);
    process.exit(1);
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    console.log("Test user already exists.");
    process.exit(0);
  }

  // Create user and auto confirm
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    console.error("Error creating user:", error);
    process.exit(1);
  }

  console.log("Test user created successfully:", data.user.id);
}

main();
