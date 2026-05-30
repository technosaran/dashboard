import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envLocal = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = `saran_${Math.floor(Math.random() * 1000000)}@gmail.com`;
  const password = "Password123!";
  
  console.log("Signing up brand new user:", email);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    console.error("Sign up failed:", signUpError.message);
    return;
  }

  const user = signUpData.user;
  if (!user) {
    console.error("Sign up succeeded but no user returned.");
    return;
  }
  console.log("User successfully signed up. ID:", user.id);

  console.log("Signing in...");
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error("Sign in failed:", signInError.message);
    return;
  }
  console.log("Successfully signed in!");

  console.log("Calling create_account_atomic RPC...");
  const { data: rpcData, error: rpcError } = await supabase.rpc("create_account_atomic", {
    p_user_id: user.id,
    p_name: "Test Savings",
    p_type: "savings",
    p_balance: 1000.00,
    p_currency: "INR",
    p_bank_name: "Test Bank"
  });

  if (rpcError) {
    console.error("RPC failed with library error:", rpcError.message);
  } else {
    console.log("RPC result:", rpcData);
  }
}

run();
