
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function getMutualFunds() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
        .from("mutual_funds")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    return data || [];
}

export async function searchMFSchemes(query: string) {
    if (query.length < 3) return [];
    try {
        const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        return data.slice(0, 10); // Return top 10 matches
    } catch (e) {
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
    } catch (e) {
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
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: res, error } = await supabase.rpc("record_mf_investment_v2" as any, {
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
        p_stamp_duty: data.stamp_duty
    });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/mutual-funds");
    return res;
}

export async function refreshNAV(mfs: { id: string, scheme_code: string }[]) {
    const supabase = await createClient();
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
