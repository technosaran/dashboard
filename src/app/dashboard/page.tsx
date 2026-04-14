import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/database.types";
import DashboardClient from "./DashboardClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all initial data on server for instant load
  const [accRes, transRes, logRes] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id),
    supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    supabase.from("ledger_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5)
  ]);

  return (
    <DashboardClient 
      initialAccounts={accRes.data || []}
      initialTransactions={transRes.data || []}
      initialLogs={(logRes.data as Tables<"ledger_logs">[]) || []}
    />
  );
}
