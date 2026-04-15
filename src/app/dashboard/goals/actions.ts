
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

type GoalRpcResult = {
    success: boolean;
    error?: string | null;
};

export async function createGoal(data: {
    name: string;
    target_amount: number;
    current_amount?: number;
    deadline?: string;
    category?: string;
    account_id?: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const rpc = supabase.rpc as unknown as (
        fn: "initialize_goal",
        args: {
            p_user_id: string;
            p_name: string;
            p_target_amount: number;
            p_initial_amount: number;
            p_deadline: string | null;
            p_category: string;
            p_account_id: string | null;
        }
    ) => Promise<{ data: GoalRpcResult | null; error: { message: string } | null }>;

    const { data: res, error } = await rpc("initialize_goal", {
        p_user_id: user.id,
        p_name: data.name,
        p_target_amount: data.target_amount,
        p_initial_amount: data.current_amount || 0,
        p_deadline: data.deadline || null,
        p_category: data.category || 'Others',
        p_account_id: data.account_id || null
    });

    if (error) return { error: error.message };
    if (!res?.success) return { error: res?.error || "Failed to create goal" };
    
    revalidatePath("/dashboard/goals");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard/accounts");
    return { success: true };
}

export async function updateGoalAmount(goalId: string, amount: number, accountId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase.rpc("contribute_to_goal", {
        p_user_id: user.id,
        p_goal_id: goalId,
        p_account_id: accountId,
        p_amount: amount
    });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/goals");
    revalidatePath("/dashboard/ledger");
    revalidatePath("/dashboard/accounts");
    return { success: true };
}

export async function deleteGoal(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase.from("goals").delete().eq("id", id).eq("user_id", user.id);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/goals");
    return { success: true };
}

export async function updateGoal(id: string, data: { name: string; target_amount: number; deadline?: string; category: string }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase.from("goals").update({
        name: data.name,
        target_amount: data.target_amount,
        deadline: data.deadline || null,
        category: data.category
    }).eq("id", id).eq("user_id", user.id);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/goals");
    return { success: true };
}
