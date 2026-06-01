/* eslint-disable */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

async function runDiagnostic() {
  console.log("=========================================");
  console.log("      FINANCEOS SCHEMA DIAGNOSTIC        ");
  console.log("=========================================");

  let envLocal = '';
  try {
    envLocal = fs.readFileSync('.env.local', 'utf-8');
  } catch (err) {
    console.error("❌ ERROR: Could not read .env.local file. Ensure it exists in the root directory.");
    process.exit(1);
  }

  const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/);

  const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
  const supabaseKey = keyMatch ? keyMatch[1].trim() : '';

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ ERROR: Missing Supabase URL or Publishable Key in .env.local.");
    process.exit(1);
  }

  console.log(`🔗 Connecting to Supabase: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  const tables = [
    'profiles',
    'accounts',
    'transactions',
    'ledger_logs',
    'investments',
    'mutual_funds',
    'bonds',
    'bond_transactions',
    'fno_trades',
    'alternative_assets',
    'liabilities',
    'goals',
    'recipients',
    'incomes',
    'expenses',
    'budgets',
    'forex_accounts',
    'forex_trades',
    'forex_transactions'
  ];

  console.log("\n📋 Phase 1: Verifying Table Accessibility...");
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        console.error(`❌ Table "${table}": Error -> ${error.message} (Code: ${error.code})`);
      } else {
        console.log(`✅ Table "${table}": Accessible.`);
      }
    } catch (err) {
      console.error(`❌ Table "${table}": Exception raised: ${err.message}`);
    }
  }

  console.log("\n⚡ Phase 2: Verifying RPC Functions...");
  const rpcs = [
    'get_summary_v1',
    'get_investments_v1',
    'get_cashflow_v1',
    'get_forex_v1',
    'get_family_v1',
    'get_finance_overview_v2'
  ];

  for (const rpc of rpcs) {
    try {
      const { data, error } = await supabase.rpc(rpc);
      if (error) {
        // Since we are calling without auth, a "Not authenticated" or "Unauthorized" is the expected correct response
        if (error.message.includes("authenticated") || error.message.includes("Unauthorized") || error.message.includes("permission denied")) {
          console.log(`✅ RPC "${rpc}": Correctly guarded. (Expected error: "${error.message}")`);
        } else {
          console.error(`❌ RPC "${rpc}": Failed with unexpected error -> ${error.message}`);
        }
      } else {
        console.log(`⚠ RPC "${rpc}": Responded successfully even without auth! (Verify security definer settings)`);
      }
    } catch (err) {
      console.error(`❌ RPC "${rpc}": Exception raised: ${err.message}`);
    }
  }

  console.log("\n=========================================");
  console.log("         DIAGNOSTIC COMPLETE            ");
  console.log("=========================================");
}

runDiagnostic();
