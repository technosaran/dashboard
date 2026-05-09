"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function addAlternativeAsset(formData: {
  name: string;
  category: string;
  purchase_price: number;
  current_value: number;
  purchase_date?: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("alternative_assets")
    .insert([{ ...formData, user_id: user.id }]);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/alternative-assets");
  return { success: true };
}

export async function updateAlternativeAsset(id: string, formData: any) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("alternative_assets")
    .update(formData)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/alternative-assets");
  return { success: true };
}

export async function deleteAlternativeAsset(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("alternative_assets")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/alternative-assets");
  return { success: true };
}
