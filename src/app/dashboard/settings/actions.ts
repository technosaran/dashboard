
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function resetUserData() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error("Auth retrieval error during reset:", authError);
      return { error: `Authentication failed: ${authError.message}` };
    }
    
    if (!user) {
      console.error("No active user session found for data reset.");
      return { error: "Unauthorized: No active session found. Please log in again." };
    }

    console.log(`Executing reset_user_data RPC for user: ${user.id}`);
    const { data, error } = await supabase.rpc("reset_user_data", { p_user_id: user.id });

    if (error) {
      console.error("reset_user_data RPC failed with error:", error);
      return { error: `Database error: ${error.message} (${error.code})` };
    }

    const result = data as Record<string, unknown> | null;
    const rpcSucceeded = result?.success === true;

    if (!rpcSucceeded) {
      // RPC returned a failure — run JS client deletes as a true fallback
      console.warn("reset_user_data RPC did not report success, running JS fallback deletes...", result?.error);
      try {
        await Promise.all([
          supabase.from("bond_transactions").delete().eq("user_id", user.id),
          supabase.from("bonds").delete().eq("user_id", user.id),
          supabase.from("forex_transactions").delete().eq("user_id", user.id),
          supabase.from("forex_trades").delete().eq("user_id", user.id),
          supabase.from("forex_accounts").delete().eq("user_id", user.id),
          supabase.from("alternative_assets").delete().eq("user_id", user.id),
          supabase.from("liabilities").delete().eq("user_id", user.id),
          supabase.from("budgets").delete().eq("user_id", user.id),
          supabase.from("stock_trades").delete().eq("user_id", user.id),
          supabase.from("investments").delete().eq("user_id", user.id),
          supabase.from("mutual_fund_trades").delete().eq("user_id", user.id),
          supabase.from("mutual_funds").delete().eq("user_id", user.id),
          supabase.from("transactions").delete().eq("user_id", user.id),
          supabase.from("transfers").delete().eq("user_id", user.id),
          supabase.from("expenses").delete().eq("user_id", user.id),
          supabase.from("incomes").delete().eq("user_id", user.id),
          supabase.from("goals").delete().eq("user_id", user.id),
          supabase.from("family_transfers").delete().eq("user_id", user.id),
          supabase.from("family_allowances").delete().eq("user_id", user.id),
          supabase.from("family_members").delete().eq("user_id", user.id),
        ]);
        // Attempt ledger_logs delete — blocked by immutability trigger in most cases
        try {
          await supabase.from("ledger_logs").delete().eq("user_id", user.id);
        } catch {
          console.warn("Ledger logs fallback delete blocked by immutability trigger (expected)");
        }
        await supabase.from("accounts").delete().eq("user_id", user.id);
      } catch (fallbackError) {
        console.error("JS client fallback deletes failed:", fallbackError);
        return { error: "Data reset failed. Please try again." };
      }
    } else {
      console.log("reset_user_data RPC succeeded — skipping JS fallback deletes.");
    }

    console.log("Database reset completed. Revalidating Next.js cache paths...");
    
    // Revalidate all major paths to ensure no stale data from layout or nested routes
    revalidatePath("/", "layout");
    
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Unhandled exception during resetUserData server action:", err);
    return { error: `System exception: ${err.message || "Unknown error"}` };
  }
}

type ProfileSettings = {
  enabled_modules?: string[];
  default_accounts?: Record<string, string | null>;
  base_currency?: string;
  theme?: string;
  timezone?: string;
  username?: string;
};

type SafeJson = string | number | boolean | null | { [key: string]: SafeJson | undefined } | SafeJson[];

export async function updateSettings(settings: ProfileSettings) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Build the update payload dynamically based on what was passed
    const payload: Record<string, unknown> = {};
    if (settings.enabled_modules !== undefined) payload.enabled_modules = settings.enabled_modules as unknown as SafeJson;
    if (settings.default_accounts !== undefined) payload.default_accounts = settings.default_accounts as unknown as SafeJson;
    if (settings.base_currency !== undefined) payload.base_currency = settings.base_currency;
    if (settings.theme !== undefined) payload.theme = settings.theme;
    if (settings.timezone !== undefined) payload.timezone = settings.timezone;
    if (settings.username !== undefined) payload.username = settings.username;

    if (Object.keys(payload).length === 0) return { success: true };

    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);

    if (error) return { error: error.message };
    
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("Error in updateSettings:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function checkApiHealth() {
  const apis = [
    { name: "AMFI Mutual Funds API (mfapi.in)", url: "https://api.mfapi.in/mf/122639" },
    { name: "AMFI India Fallback (amfiindia.com)", url: "https://www.amfiindia.com/spages/NAVAll.txt" },
    { name: "Tickertape Stocks API", url: "https://api.tickertape.in/search?text=RELIANCE" },
    { name: "Yahoo Finance API", url: "https://query2.finance.yahoo.com/v1/finance/search?q=RELIANCE" }
  ];

  const results = [];
  for (const api of apis) {
    try {
      const start = Date.now();
      const res = await fetch(api.url, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(3000)
      });
      const latency = Date.now() - start;
      if (res.status === 200) {
        results.push({ name: api.name, status: "Healthy", latency: `${latency}ms`, code: 200 });
      } else if (res.status === 429) {
        results.push({ name: api.name, status: "Rate Limited", latency: `${latency}ms`, code: 429 });
      } else {
        results.push({ name: api.name, status: "Degraded", latency: `${latency}ms`, code: res.status });
      }
    } catch (err) {
      results.push({ name: api.name, status: "Offline", latency: "—", code: 504, error: err instanceof Error ? err.message : "Timeout" });
    }
  }

  // Also include Supabase connection check
  try {
    const supabase = await createClient();
    const start = Date.now();
    const { error } = await supabase.from("accounts").select("id").limit(1);
    const latency = Date.now() - start;
    if (error) {
      results.push({ name: "Supabase DB Connection", status: "Degraded", latency: `${latency}ms`, code: 500, error: error.message });
    } else {
      results.push({ name: "Supabase DB Connection", status: "Healthy", latency: `${latency}ms`, code: 200 });
    }
  } catch (err) {
    results.push({ name: "Supabase DB Connection", status: "Offline", latency: "—", code: 500, error: err instanceof Error ? err.message : "Unknown" });
  }

  return { success: true, results };
}

