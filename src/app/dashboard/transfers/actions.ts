"use server";

import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { createTransfer as internalCreateTransfer } from "../accounts/actions";

// Explicitly re-export for clarity and to resolve build-time path resolution issues
export const createTransfer = internalCreateTransfer;

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
