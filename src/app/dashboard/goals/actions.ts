
"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function createGoal(data: {
    name: string;
    target_amount: number;
    current_amount?: number;
    deadline?: string;
    category?: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase.from("goals").insert({
        ...data,
        user_id: user.id
    });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/goals");
}

export async function updateGoalAmount(goalId: string, amount: number) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("contribute_to_goal", {
        p_goal_id: goalId,
        p_amount: amount
    });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/goals");
}

export async function deleteGoal(id: string) {
    const supabase = await createClient();
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/goals");
}
