/* eslint-disable no-console */
"use server";

import { createClient } from "@/lib/supabase-server";
import { getFriendlyErrorMessage } from "@/lib/action-utils";
import { revalidatePath } from "next/cache";
import { Client } from "pg";

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
    
    return { success: true, message: "Reset User Data successful" };
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
  sms_sync_token?: string | null;
  gmail_refresh_token?: string | null;
  telegram_chat_id?: string | null;
  telegram_link_code?: string | null;
  gemini_api_key?: string | null;
  gemini_enabled?: boolean;
};

type SafeJson = string | number | boolean | null | { [key: string]: SafeJson | undefined } | SafeJson[];

async function updateProfileWithPg(userId: string, geminiKey?: string | null, geminiEnabled?: boolean) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return false;
  try {
    const client = new Client({ connectionString });
    await client.connect();
    // 1. Ensure columns exist
    await client.query(`
      ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS gemini_api_key TEXT,
      ADD COLUMN IF NOT EXISTS gemini_enabled BOOLEAN DEFAULT true;
    `);
    // 2. Direct SQL update
    if (geminiKey !== undefined && geminiEnabled !== undefined) {
      await client.query(
        `UPDATE public.profiles SET gemini_api_key = $1, gemini_enabled = $2 WHERE id = $3`,
        [geminiKey, geminiEnabled, userId]
      );
    } else if (geminiKey !== undefined) {
      await client.query(
        `UPDATE public.profiles SET gemini_api_key = $1 WHERE id = $2`,
        [geminiKey, userId]
      );
    } else if (geminiEnabled !== undefined) {
      await client.query(
        `UPDATE public.profiles SET gemini_enabled = $1 WHERE id = $2`,
        [geminiEnabled, userId]
      );
    }
    // 3. Notify PostgREST schema cache reload
    await client.query("NOTIFY pgrst, 'reload schema';");
    await client.end();
    return true;
  } catch (e) {
    console.warn("Direct pg update for gemini columns failed:", e);
    return false;
  }
}

export async function updateSettings(settings: ProfileSettings) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const payload: Record<string, unknown> = {};
    if (settings.enabled_modules !== undefined) payload.enabled_modules = settings.enabled_modules as unknown as SafeJson;
    if (settings.default_accounts !== undefined) payload.default_accounts = settings.default_accounts as unknown as SafeJson;
    if (settings.base_currency !== undefined) payload.base_currency = settings.base_currency;
    if (settings.theme !== undefined) payload.theme = settings.theme;
    if (settings.timezone !== undefined) payload.timezone = settings.timezone;
    if (settings.username !== undefined) payload.username = settings.username;
    if (settings.sms_sync_token !== undefined) payload.sms_sync_token = settings.sms_sync_token;
    if (settings.gmail_refresh_token !== undefined) payload.gmail_refresh_token = settings.gmail_refresh_token;
    if (settings.telegram_chat_id !== undefined) payload.telegram_chat_id = settings.telegram_chat_id;
    if (settings.telegram_link_code !== undefined) payload.telegram_link_code = settings.telegram_link_code;
    if (settings.gemini_api_key !== undefined) payload.gemini_api_key = settings.gemini_api_key;
    if (settings.gemini_enabled !== undefined) payload.gemini_enabled = settings.gemini_enabled;

    if (Object.keys(payload).length === 0) return { success: true, message: "Settings updated successfully" };

    const { error } = await supabase
      .from("profiles")
      .update(payload as any)
      .eq("id", user.id);

    if (error && (
      error.message?.includes("column") || 
      error.message?.includes("schema cache") || 
      (error as any).code === "PGRST204" || 
      (error as any).code === "42703"
    )) {
      console.log("PostgREST schema cache missing gemini columns, executing direct pg fallback update...");
      const pgSuccess = await updateProfileWithPg(user.id, settings.gemini_api_key, settings.gemini_enabled);
      if (pgSuccess) {
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/settings");
        return { success: true, message: "Settings updated successfully" };
      }

      // If pg fallback failed or DATABASE_URL not set, attempt update without gemini columns so remaining settings save
      const cleanPayload = { ...payload };
      delete cleanPayload.gemini_api_key;
      delete cleanPayload.gemini_enabled;

      if (Object.keys(cleanPayload).length > 0) {
        await supabase.from("profiles").update(cleanPayload as any).eq("id", user.id);
      }

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/settings");

      return {
        error: "The 'gemini_api_key' column does not exist on your Supabase 'profiles' table yet. Please run the SQL migration script in your Supabase SQL Editor:\n\nALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key TEXT, ADD COLUMN IF NOT EXISTS gemini_enabled BOOLEAN DEFAULT true;\nNOTIFY pgrst, 'reload schema';",
      };
    }

    if (error) return { error: getFriendlyErrorMessage(error) };
    
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true, message: "Settings updated successfully" };
  } catch (err) {
    console.error("Error in updateSettings:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function generateTelegramLinkCode() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const code = `tg-${Math.floor(100000 + Math.random() * 900000)}`;

    const { error } = await supabase
      .from("profiles")
      .update({ telegram_link_code: code })
      .eq("id", user.id);

    if (error) {
      console.error("Failed to generate Telegram link code:", error);
      return { error: error.message };
    }

    revalidatePath("/dashboard/settings");
    return { success: true, code };
  } catch (err) {
    console.error("Error in generateTelegramLinkCode:", err);
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function checkApiHealth() {
  // Auth guard — only authenticated users may trigger outbound API health checks
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const apis = [
    { name: "AMFI Mutual Funds API (mfapi.in)", url: "https://api.mfapi.in/mf/122639" },
    { name: "AMFI India Official NAV (amfiindia.com)", url: "https://www.amfiindia.com/spages/NAVAll.txt" },
    { name: "Groww Mutual Funds API", url: "https://groww.in/v1/api/search/v1/derived/scheme?availableForInvestment=true&docType=scheme&plan_type=Direct&q=HDFC" },
    { name: "Yahoo Finance Chart API (v8)", url: "https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS" },
    { name: "Yahoo Finance Search API", url: "https://query2.finance.yahoo.com/v1/finance/search?q=RELIANCE" },
    { name: "Tickertape Stocks API", url: "https://api.tickertape.in/search?text=RELIANCE" }
  ];

  const results = [];
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  for (const api of apis) {
    try {
      const start = Date.now();
      const res = await fetch(api.url, {
        method: "GET",
        headers: { 
          "User-Agent": userAgent,
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8000)
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
      results.push({ name: api.name, status: "Offline", latency: "—", code: 504, error: err instanceof Error ? err.message : "Timeout / Connection Failed" });
    }
  }

  // Also include Supabase connection check
  try {
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

export async function triggerAllMarketSync() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { syncAllMutualFundPrices } = await import("@/lib/sync-mf");
    const { syncAllCryptoPrices } = await import("@/lib/sync-crypto");

    const [mfRes, cryptoRes] = await Promise.all([
      syncAllMutualFundPrices(),
      syncAllCryptoPrices(),
    ]);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/mutual-funds");
    revalidatePath("/dashboard/crypto");

    return {
      success: true,
      message: `Sync complete! Updated ${mfRes.updatedCount} Mutual Funds & ${cryptoRes.updatedCount} Crypto assets.`,
    };
  } catch (err) {
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function triggerRecurringCronAction() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(`${appUrl}/api/cron/recurring-transactions`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET || ""}` },
      cache: "no-store",
    });

    if (!res.ok) {
      // Direct JS fallback if internal HTTP fetch fails
      const todayStr = new Date().toISOString().split("T")[0];
      const currentDay = new Date().getDate();

      const { data: incs } = await supabase.from("incomes").select("*").eq("user_id", user.id).eq("is_recurring", true);
      const { data: exps } = await supabase.from("expenses").select("*").eq("user_id", user.id).eq("is_recurring", true);

      let posted = 0;
      if (incs) {
        for (const inc of incs) {
          if (Number(inc.recurrence_day) === currentDay) {
            const { data: exist } = await supabase.from("incomes").select("id").eq("user_id", user.id).eq("description", inc.description).eq("date", todayStr).maybeSingle();
            if (!exist) {
              await supabase.from("incomes").insert({ user_id: user.id, description: inc.description, amount: inc.amount, category: inc.category || "Salary", account_id: inc.account_id, date: todayStr, is_recurring: false });
              if (inc.account_id) {
                const { data: acc } = await supabase.from("accounts").select("balance").eq("id", inc.account_id).single();
                if (acc) {
                  await supabase.from("accounts").update({ balance: Number(acc.balance) + Number(inc.amount) }).eq("id", inc.account_id);
                }
              }
              posted++;
            }
          }
        }
      }

      if (exps) {
        for (const exp of exps) {
          if (Number(exp.recurrence_day) === currentDay) {
            const { data: exist } = await supabase.from("expenses").select("id").eq("user_id", user.id).eq("description", exp.description).eq("date", todayStr).maybeSingle();
            if (!exist) {
              await supabase.from("expenses").insert({ user_id: user.id, description: exp.description, amount: exp.amount, category: exp.category || "General", account_id: exp.account_id, date: todayStr, is_recurring: false });
              if (exp.account_id) {
                const { data: acc } = await supabase.from("accounts").select("balance").eq("id", exp.account_id).single();
                if (acc) {
                  await supabase.from("accounts").update({ balance: Number(acc.balance) - Number(exp.amount) }).eq("id", exp.account_id);
                }
              }
              posted++;
            }
          }
        }
      }

      revalidatePath("/dashboard");
      return { success: true, message: `Processed recurring engine! Posted ${posted} due items for today.` };
    }

    const data = await res.json();
    revalidatePath("/dashboard");
    return { success: true, message: data.message || "Processed recurring transactions!" };
  } catch (err) {
    return { error: getFriendlyErrorMessage(err) };
  }
}

export async function triggerTelegramBackupAction() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase.from("profiles").select("telegram_chat_id, username, base_currency").eq("id", user.id).single();
    if (!profile?.telegram_chat_id) {
      return { error: "Please connect Telegram bot first in Settings > Integrations." };
    }

    const { sendTelegramDocument } = await import("@/lib/telegram");

    const [accsRes, invsRes, txsRes, incsRes, expsRes, budgsRes] = await Promise.all([
      supabase.from("accounts").select("*").eq("user_id", user.id),
      supabase.from("investments").select("*").eq("user_id", user.id),
      supabase.from("transactions").select("*").eq("user_id", user.id),
      supabase.from("incomes").select("*").eq("user_id", user.id),
      supabase.from("expenses").select("*").eq("user_id", user.id),
      supabase.from("budgets").select("*").eq("user_id", user.id),
    ]);

    const backupObj = {
      exportedAt: new Date().toISOString(),
      username: profile.username || "User",
      currency: profile.base_currency || "INR",
      accounts: accsRes.data || [],
      investments: invsRes.data || [],
      transactions: txsRes.data || [],
      incomes: incsRes.data || [],
      expenses: expsRes.data || [],
      budgets: budgsRes.data || [],
    };

    const jsonStr = JSON.stringify(backupObj, null, 2);
    const fileName = `arthaX_backup_${new Date().toISOString().split("T")[0]}.json`;

    await sendTelegramDocument(
      profile.telegram_chat_id,
      fileName,
      jsonStr,
      "📦 *Complete Financial Backup File*\n\nContains all your accounts, investments, transactions, and budgets. Keep this safe!"
    );

    return { success: true, message: "Backup file sent directly to your Telegram chat!" };
  } catch (err) {
    return { error: getFriendlyErrorMessage(err) };
  }
}
