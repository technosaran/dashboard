import { createClient } from "@/lib/supabase-server";
import AccountsClient from "./AccountsClient";
import { redirect } from "next/navigation";
import type { FinanceData } from "@/hooks/use-finance-data";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accounts",
  description: "Monitor and manage your bank accounts, wallets, and cash reserves in real-time.",
};

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Prefetch data on the server for "0 latency" initial load
  const { data: initialData } = await supabase.rpc("get_finance_overview");

  return (
    <AccountsClient initialData={initialData as unknown as FinanceData} />
  );
}
