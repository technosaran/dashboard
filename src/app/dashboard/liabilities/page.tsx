import { Suspense } from "react";
import LiabilitiesClient from "./LiabilitiesClient";
import { createClient } from "@/lib/supabase-server";
import type { FinanceData } from "@/hooks/use-finance-data";

export const metadata = {
  title: "Liabilities & Debt | FinanceOS",
  description: "Track and manage your loans, EMIs, and outstanding debts.",
};

export default async function LiabilitiesPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_finance_overview_v2");

  return (
    <Suspense fallback={<div className="animate-pulse bg-white/5 h-screen rounded-2xl" />}>
      <LiabilitiesClient initialData={data as FinanceData} />
    </Suspense>
  );
}
