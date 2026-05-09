
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

type MutualFundRpcResult = {
    success?: boolean;
    error?: string | null;
} | null;

export async function searchMFSchemes(query: string) {
    if (query.length < 3) return [];
    try {
        const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        return data.slice(0, 10); // Return top 10 matches
    } catch {
        return [];
    }
}

export async function getLiveNAV(schemeCode: string) {
    try {
        const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
        const data = await res.json();
        if (data?.data?.length > 0) {
            return {
                nav: parseFloat(data.data[0].nav),
                date: data.data[0].date,
                fund_name: data.meta.scheme_name,
                amc: data.meta.amc
            };
        }
    } catch {
        return null;
    }
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

    const results = [];

    for (const mf of mfs) {
        if (!mf.scheme_code) continue;
        const live = await getLiveNAV(mf.scheme_code);
        if (live) {
            await supabase.from("mutual_funds").update({ 
                current_nav: live.nav, 
                last_nav_updated_at: new Date().toISOString() 
            }).eq("id", mf.id);
            results.push({ id: mf.id, nav: live.nav });
        }
    }
    revalidatePath("/dashboard/mutual-funds");
    return results;
}
