import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Querying profiles...");
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
  console.log("Profiles:", profiles, "Error:", pError?.message);

  console.log("Querying accounts...");
  const { data: accounts, error: aError } = await supabase.from('accounts').select('*');
  console.log("Accounts:", accounts, "Error:", aError?.message);

  console.log("Querying ledger_logs...");
  const { data: logs, error: lError } = await supabase.from('ledger_logs').select('*').limit(5);
  console.log("Ledger logs:", logs, "Error:", lError?.message);
}

test();
