import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/database.types";
import DashboardClient from "./DashboardClient";
import type { FinanceData } from "@/hooks/use-finance-data";
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

  // Prefetch data on the server for "0 latency" initial load
  const { data: initialData } = await supabase.rpc("get_finance_overview");

  return (
    <DashboardClient initialData={initialData as unknown as FinanceData} />
  );
}
