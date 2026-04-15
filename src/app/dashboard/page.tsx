import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/database.types";
import DashboardClient from "./DashboardClient";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your financial command center. Track net worth, cash flow, and portfolio performance at a glance.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch all initial data on server for instant load
  const [accRes, transRes, logRes, invRes, mfRes] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id),
    supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    supabase.from("ledger_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("investments").select("*").eq("user_id", user.id),
    supabase.from("mutual_funds").select("*").eq("user_id", user.id)
  ]);

  return (
    <DashboardClient 
      initialAccounts={accRes.data || []}
      initialTransactions={transRes.data || []}
      initialLogs={(logRes.data as Tables<"ledger_logs">[]) || []}
      initialInvestments={invRes.data || []}
      initialMutualFunds={mfRes.data || []}
    />
  );
}
