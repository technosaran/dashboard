
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { parseToISODate } from "@/lib/utils";


type MutualFundRpcResult = {
    success?: boolean;
    error?: string | null;
} | null;
// Simple in-memory caches to survive server process lifecycles and avoid rate limiting
const navCache = new Map<string, { nav: number; previousNav?: number; timestamp: number }>();
const NAV_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

let amfiCacheText: string | null = null;
let amfiCacheTime = 0;
const AMFI_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getAmfiNavText(): Promise<string | null> {
  const now = Date.now();
  if (amfiCacheText && (now - amfiCacheTime < AMFI_CACHE_TTL)) {
    return amfiCacheText;
  }

  try {
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const res = await fetch("https://www.amfiindia.com/spages/NAVAll.txt", {
      cache: "no-store",
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(10000) // Allow up to 10 seconds for large text list download
    });
    if (res.ok) {
      const text = await res.text();
      amfiCacheText = text;
      amfiCacheTime = now;
      return text;
    }
  } catch (err) {
    console.error("Failed to fetch AMFI text file", err);
  }

  return amfiCacheText;
}

export async function searchMFSchemes(query: string) {
  if (!query || query.length < 2) return [];
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  
  // 1. Try api.mfapi.in search
  try {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      const results = (data || []).map((s: { schemeCode?: number; schemeName: string }) => ({
        schemeCode: s.schemeCode?.toString(),
        schemeName: s.schemeName
      }));
      if (results.length > 0) return results;
    }
  } catch (err) {
    console.warn("MFAPI Search failed, trying Groww fallback", err);
  }

  // 2. Try Groww MF API fallback (removed Direct plan constraint)
  try {
    const res = await fetch(`https://groww.in/v1/api/search/v1/derived/scheme?availableForInvestment=true&docType=scheme&q=${encodeURIComponent(query)}`, {
      cache: "no-store",
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.content && data.content.length > 0) {
        const results = data.content.map((s: { scheme_code?: string; scheme_name?: string; fund_name?: string }) => ({
          schemeCode: s.scheme_code?.toString() || "",
          schemeName: s.scheme_name || s.fund_name || ""
        })).filter((s: { schemeCode: string; schemeName: string }) => s.schemeCode && s.schemeName);
        if (results.length > 0) return results;
      }
    }
  } catch (err) {
    console.warn("Groww MF search fallback failed, trying AMFI fallback", err);
  }

  // 3. Try AMFI search fallback using the cached text
  try {
    const text = await getAmfiNavText();
    if (text) {
      const lines = text.split("\n");
      const qLower = query.toLowerCase();
      const results = [];
      for (const line of lines) {
        if (line.includes(";")) {
          const parts = line.split(";");
          if (parts.length >= 4 && parts[3].toLowerCase().includes(qLower)) {
            results.push({ schemeCode: parts[0].trim(), schemeName: parts[3].trim() });
            if (results.length >= 15) break;
          }
        }
      }
      if (results.length > 0) return results;
    }
  } catch (err) {
    console.error("AMFI search fallback failed", err);
  }
  return [];
}

export async function fetchLiveMFNAV(schemeCode: string) {
  const now = Date.now();
  const cached = navCache.get(schemeCode);
  if (cached && (now - cached.timestamp < NAV_CACHE_TTL)) {
    return { nav: cached.nav, previousNav: cached.previousNav };
  }

  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  
  // Try api.mfapi.in first
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, { 
      cache: "no-store",
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.data && data.data.length > 0) {
        const currentNav = parseFloat(data.data[0].nav);
        const previousNav = data.data.length > 1 ? parseFloat(data.data[1].nav) : undefined;
        
        // Cache the healthy result
        navCache.set(schemeCode, { nav: currentNav, previousNav, timestamp: now });
        return { nav: currentNav, previousNav };
      }
    }
  } catch (err) {
    console.warn(`MFAPI NAV failed for ${schemeCode}, trying Groww fallback`, err);
  }
  
  // Try Groww MF API fallback (removed Direct plan constraint)
  try {
    const res = await fetch(`https://groww.in/v1/api/search/v1/derived/scheme?availableForInvestment=true&docType=scheme&q=${schemeCode}`, {
      cache: "no-store",
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.content && data.content.length > 0) {
        const matched = data.content.find((s: any) => s.scheme_code === schemeCode);
        if (matched && typeof matched.nav === "number") {
          navCache.set(schemeCode, { nav: matched.nav, timestamp: now });
          return { nav: matched.nav };
        }
      }
    }
  } catch (err) {
    console.warn(`Groww NAV failed for ${schemeCode}, trying AMFI fallback`, err);
  }

  // Try AMFI fallback
  try {
    const text = await getAmfiNavText();
    if (text) {
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith(`${schemeCode};`)) {
          const parts = line.split(";");
          const currentNav = parseFloat(parts[4].trim());
          if (!isNaN(currentNav)) {
            // Cache the result
            navCache.set(schemeCode, { nav: currentNav, timestamp: now });
            return { nav: currentNav };
          }
        }
      }
    }
  } catch (err) {
    console.error("AMFI fallback search failed", err);
  }
  
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
    try {
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

        const rpc = supabase.rpc.bind(supabase) as unknown as (
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
    } catch (err) {
        console.error("Error in recordMFInvestment:", err);
        return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
    }
}

export async function updateMFHolding(id: string, data: {
  fund_name?: string;
  amc_name?: string;
  scheme_code?: string;
  fund_symbol?: string;
  units?: number;
  avg_nav?: number;
  current_nav?: number;
  previous_nav?: number;
  category?: string;
  investment_type?: string;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.fund_name !== undefined) payload.fund_name = data.fund_name;
    if (data.amc_name !== undefined) payload.amc_name = data.amc_name;
    if (data.scheme_code !== undefined) payload.scheme_code = data.scheme_code;
    if (data.fund_symbol !== undefined) payload.fund_symbol = data.fund_symbol;
    if (data.units !== undefined) payload.units = data.units;
    if (data.avg_nav !== undefined) payload.avg_nav = data.avg_nav;
    if (data.current_nav !== undefined) payload.current_nav = data.current_nav;
    if (data.previous_nav !== undefined) payload.previous_nav = data.previous_nav;
    if (data.category !== undefined) payload.category = data.category;
    if (data.investment_type !== undefined) payload.investment_type = data.investment_type;

    const { error } = await supabase
      .from("mutual_funds")
      .update(payload as any)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/mutual-funds");
    return { success: true };
  } catch (err) {
    console.error("Error in updateMFHolding:", err);
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
