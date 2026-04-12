import { createClient } from "@/lib/supabase-server";
import LedgerClient from "./LedgerClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("ledger_logs")
    .select("id, created_at, account_name, action_type, amount, previous_balance, new_balance, details")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <LedgerClient initialLogs={data || []} />;
}
