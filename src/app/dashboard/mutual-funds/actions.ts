
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { revertLedgerLog as revertAction } from "../alternative-assets/actions";

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

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
    let lastError: Error | null = null;
    for (let i = 0; i < retries; i++) {
        try {
            const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
            const res = await fetch(url, { 
                headers: { 
                    "User-Agent": userAgent,
                    "Accept": "application/json",
                    "Cache-Control": "no-cache"
                },
                cache: "no-store", 
                next: { revalidate: 0 } 
            });
            if (res.ok) return res;
            if (res.status === 429) {
                const wait = 1000 * (i + 1) + Math.random() * 500;
                await new Promise(r => setTimeout(r, wait));
            }
        } catch (e) {
            lastError = e as Error;
            await new Promise(r => setTimeout(r, 500 * (i + 1)));
        }
    }
    throw lastError || new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

export async function getLiveNAV(schemeCode: string) {
    if (!schemeCode) return null;
    try {
        const res = await fetchWithRetry(`https://api.mfapi.in/mf/${schemeCode}`);
        const data = await res.json();
        if (data?.data?.length > 0) {
            const nav = parseFloat(data.data[0].nav);
            const prevNav = data.data.length > 1 ? parseFloat(data.data[1].nav) : nav;
            const change = nav - prevNav;
            const changePercent = prevNav > 0 ? (change / prevNav) * 100 : 0;

            return {
                nav,
                prevNav,
                dayChange: change,
                dayChangePercent: changePercent,
                date: data.data[0].date,
                fund_name: data.meta.scheme_name,
                amc: data.meta.amc
            };
        }
    } catch (error) {
        console.error(`NAV Fetch Error for ${schemeCode}:`, error);
        return null;
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
            p_account_id: string;
            p_stamp_duty: number;
            p_trade_type: "buy" | "sell";
        }
    ) => Promise<{ data: MutualFundRpcResult; error: { message: string } | null }>;

    const { data: res, error } = await rpc("record_mf_investment_v4", {
        p_user_id: user.id,
        p_fund_name: data.fund_name,
        p_scheme_code: data.scheme_code,
        p_units: data.units,
        p_nav: data.nav,
        p_investment_type: data.investment_type,
        p_category: data.category,
        p_amc_name: data.amc_name,
        p_date: data.date,
        p_account_id: data.account_id,
        p_stamp_duty: data.stamp_duty,
        p_trade_type: data.trade_type || "buy"
    });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/mutual-funds");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard");
    return res;
}

export async function refreshNAV(mfs: { id: string, scheme_code: string }[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const BATCH_SIZE = 10;
    const DELAY = 200;
    const results = [];

    for (let i = 0; i < mfs.length; i += BATCH_SIZE) {
        const batch = mfs.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async (mf) => {
            if (!mf.scheme_code) return null;
            try {
                const live = await getLiveNAV(mf.scheme_code);
                if (live) {
                    const { error } = await supabase.from("mutual_funds").update({ 
                        current_nav: live.nav, 
                        previous_nav: live.prevNav,
                        day_change: live.dayChange,
                        day_change_percent: live.dayChangePercent,
                        last_nav_updated_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }).eq("id", mf.id);
                    
                    if (error) console.error(`DB Update Error for MF ${mf.id}:`, error);
                    return { id: mf.id, nav: live.nav, prevNav: live.prevNav };
                }
            } catch (e) {
                console.error(`Refresh error for MF ${mf.id}:`, e);
            }
            return null;
        }));
        
        results.push(...batchResults.filter(Boolean));
        if (i + BATCH_SIZE < mfs.length) await new Promise(r => setTimeout(r, DELAY));
    }

    revalidatePath("/dashboard/mutual-funds");
    revalidatePath("/dashboard");
    return results;
}
