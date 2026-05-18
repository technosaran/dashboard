import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Testing connection to", supabaseUrl);
  const { data, error } = await supabase.from('accounts').select('id').limit(1);
  if (error) {
    console.error("Error fetching accounts:", error.message);
  } else {
    console.log("Success! Found accounts:", data);
  }

  const { data: d2, error: e2 } = await supabase.rpc('get_finance_overview_v2');
  if (e2) {
    console.error("Error with get_finance_overview_v2:", e2.message);
  } else {
    console.log("get_finance_overview_v2 success!");
  }
}

test();
