"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

// Re-export the improved transfer logic from accounts actions to avoid duplication
export { createTransfer } from "../accounts/actions";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
