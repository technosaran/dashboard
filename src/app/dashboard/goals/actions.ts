"use server";

import { createClient } from "@/lib/supabase-server";
import { getFriendlyErrorMessage } from "@/lib/action-utils";
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
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Unauthorized" };

        // Input validation
        if (!data.name || data.name.trim().length === 0) {
            return { error: "Goal name is required" };
        }
        if (!data.target_amount || data.target_amount <= 0 || !Number.isFinite(data.target_amount)) {
            return { error: "Target amount must be a positive number" };
        }
        if (data.current_amount !== undefined && data.current_amount < 0) {
            return { error: "Initial amount cannot be negative" };
        }

        // Harden input parameters to prevent empty string UUID database crashes
        const cleanAccountId = data.account_id && 
          data.account_id.trim().length > 0 && 
          data.account_id !== "null" && 
          data.account_id !== "undefined" 
            ? data.account_id 
            : null;

        const rpc = supabase.rpc.bind(supabase) as unknown as (
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
            p_account_id: cleanAccountId
        });

        if (error) return { error: getFriendlyErrorMessage(error) };
        if (!res?.success) return { error: res?.error || "Failed to create goal" };
        
        revalidatePath("/dashboard/goals");
        revalidatePath("/dashboard/ledger");
        revalidatePath("/dashboard/accounts");
        return { success: true, message: "Goal created successfully" };
    } catch (err) {
        console.error("Error in createGoal:", err);
        return { error: getFriendlyErrorMessage(err) };
    }
}

export async function updateGoalAmount(goalId: string, amount: number, accountId: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Unauthorized" };

        // Input validation
        if (!goalId) return { error: "Goal ID is required" };
        if (!amount || amount <= 0 || !Number.isFinite(amount)) {
            return { error: "Contribution amount must be a positive number" };
        }
        if (!accountId) return { error: "Account is required" };

        const { data: rpcData, error } = await supabase.rpc("contribute_to_goal", {
            p_user_id: user.id,
            p_goal_id: goalId,
            p_account_id: accountId,
            p_amount: amount
        });

        if (error) return { error: getFriendlyErrorMessage(error) };
        const res = rpcData as { success: boolean; error?: string } | null;
        if (!res) return { error: "Failed to communicate with database" };
        if (!res.success) return { error: res.error || "Contribution failed" };

        revalidatePath("/dashboard/goals");
        revalidatePath("/dashboard/ledger");
        revalidatePath("/dashboard/accounts");
        return { success: true, message: "Goal Amount updated successfully" };
    } catch (err) {
        console.error("Error in updateGoalAmount:", err);
        return { error: getFriendlyErrorMessage(err) };
    }
}

export async function deleteGoal(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Unauthorized" };

        const { data, error } = await supabase.rpc("atomic_delete_entity", {
            p_user_id: user.id,
            p_entity_type: "goal",
            p_entity_id: id
        });

        if (error) return { error: getFriendlyErrorMessage(error) };
        const res = data as { success: boolean; error?: string } | null;
        if (!res?.success) return { error: res?.error || "Failed to delete goal atomically" };

        revalidatePath("/dashboard/goals");
        revalidatePath("/dashboard/ledger");
        revalidatePath("/dashboard/accounts");
        return { success: true, message: "Goal deleted successfully" };
    } catch (err) {
        console.error("Error in deleteGoal:", err);
        return { error: getFriendlyErrorMessage(err) };
    }
}

export async function updateGoal(id: string, data: { name: string; target_amount: number; deadline?: string; category: string }) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { error: "Unauthorized" };

        const { error } = await supabase.from("goals").update({
            name: data.name,
            target_amount: data.target_amount,
            deadline: data.deadline || null,
            category: data.category
        }).eq("id", id).eq("user_id", user.id);

        if (error) return { error: getFriendlyErrorMessage(error) };
        revalidatePath("/dashboard/goals");
        return { success: true, message: "Goal updated successfully" };
    } catch (err) {
        console.error("Error in updateGoal:", err);
        return { error: getFriendlyErrorMessage(err) };
    }
}
