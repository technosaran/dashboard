"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function addLiability(formData: {
  name: string;
  category: string;
  total_amount: number;
  remaining_amount: number;
  interest_rate?: number;
  monthly_payment?: number;
  due_date?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("liabilities")
    .insert([{ ...formData, user_id: user.id }]);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/liabilities");
  return { success: true };
}

export async function updateLiability(id: string, formData: any) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("liabilities")
    .update(formData)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/liabilities");
  return { success: true };
}

export async function deleteLiability(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("liabilities")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/liabilities");
  return { success: true };
}
