import { createClient } from "@/lib/supabase-server";
import MutualFundsClient from "./MutualFundsClient";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import type { FinanceData } from "@/hooks/use-finance-data";

export const metadata: Metadata = {
  title: "Mutual Funds",
  description: "Advanced mutual fund portfolio management. Track direct schemes, NAV performance, and SIP allocations.",
};

export const dynamic = "force-dynamic";

export default async function MutualFundsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Prefetch data on server for instant load
  const { data: initialData } = await supabase.rpc("get_finance_overview");
  
  return <MutualFundsClient initialData={initialData as unknown as FinanceData} />;
}
