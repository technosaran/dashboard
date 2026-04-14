import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/database.types";
import FamilyClient from "./FamilyClient";
import { redirect } from "next/navigation";
import { getAccounts } from "../accounts/actions";

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [recipRes, accRes, historyRes] = await Promise.all([
    supabase.from("recipients").select("*").eq("user_id", user.id).order("name"),
    getAccounts(),
    supabase
      .from("ledger_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("action_type", "SEND_MONEY")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <FamilyClient 
      initialRecipients={(recipRes.data as Tables<"recipients">[]) || []}
      initialAccounts={accRes.data || []}
      initialHistory={(historyRes.data as Tables<"ledger_logs">[]) || []}
    />
  );
}
