
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { revertLedgerLog as revertAction } from "../alternative-assets/actions";
import { parseToISODate } from "@/lib/utils";

export async function revertLedgerLog(logId: string) {
    return await revertAction(logId);
}

type MutualFundRpcResult = {
    success?: boolean;
    error?: string | null;
} | null;

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0"
];

export async function searchMFSchemes(query: string) {
    if (query.length < 3) return [];
    try {
        const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
        const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`, {
            headers: { "User-Agent": userAgent }
        });
        const data = await res.json();
        return data.slice(0, 10);
    } catch {
        return [];
    }
}

export async function getLiveNAV() {
    return null;
}

export async function recordMFInvestment(data: {
    fund_name: string;
    scheme_code: string;
    units: number;
    nav: number;
    investment_type: string;
    category: string;
    amc_name: string;
    date: string;
    account_id: string;
    stamp_duty: number;
    trade_type?: "buy" | "sell";
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Input validation
    if (!data.fund_name || data.fund_name.trim().length === 0) {
        return { error: "Fund name is required" };
    }
    if (!data.units || data.units <= 0 || !Number.isFinite(data.units)) {
        return { error: "Units must be a positive number" };
    }
    if (!data.nav || data.nav <= 0 || !Number.isFinite(data.nav)) {
        return { error: "NAV must be a positive number" };
    }

    // Harden input parameters to prevent empty string UUID database crashes
    const cleanAccountId = data.account_id && 
      data.account_id.trim().length > 0 && 
      data.account_id !== "null" && 
      data.account_id !== "undefined" 
        ? data.account_id 
        : null;

    const rpc = supabase.rpc as unknown as (
        fn: "record_mf_investment_v4",
        args: {
            p_user_id: string;
            p_fund_name: string;
            p_scheme_code: string;
            p_units: number;
            p_nav: number;
            p_investment_type: string;
            p_category: string;
            p_amc_name: string;
            p_date: string;
            p_account_id: string | null;
            p_stamp_duty: number;
            p_trade_type: "buy" | "sell";
        }
    ) => Promise<{ data: MutualFundRpcResult; error: { message: string } | null }>;

    const cleanDate = parseToISODate(data.date);

    const { data: res, error } = await rpc("record_mf_investment_v4", {
        p_user_id: user.id,
        p_fund_name: data.fund_name,
        p_scheme_code: data.scheme_code,
        p_units: data.units,
        p_nav: data.nav,
        p_investment_type: data.investment_type,
        p_category: data.category,
        p_amc_name: data.amc_name,
        p_date: cleanDate,
        p_account_id: cleanAccountId,
        p_stamp_duty: data.stamp_duty,
        p_trade_type: data.trade_type || "buy"
    });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/mutual-funds");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard");
    return res;
}

export async function refreshNAV() {
    return [];
}

export async function updateMFHolding(id: string, data: {
  fund_name?: string;
  amc_name?: string;
  scheme_code?: string;
  fund_symbol?: string;
  units?: number;
  avg_nav?: number;
  current_nav?: number;
  category?: string;
  investment_type?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("mutual_funds")
    .update({ 
      fund_name: data.fund_name,
      amc_name: data.amc_name,
      scheme_code: data.scheme_code,
      fund_symbol: data.fund_symbol,
      units: data.units,
      avg_nav: data.avg_nav,
      current_nav: data.current_nav,
      category: data.category,
      investment_type: data.investment_type,
      updated_at: new Date().toISOString() 
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/mutual-funds");
  return { success: true };
}
