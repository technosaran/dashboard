import { Suspense } from "react";
import BudgetClient from "./BudgetClient";
import { createClient } from "@/lib/supabase-server";
import type { FinanceData } from "@/hooks/use-finance-data";

export const metadata = {
  title: "Budget Planner | FinanceOS",
  description: "Strategize your monthly spending and track savings potential.",
};

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_finance_overview_v2");

  return (
    <Suspense fallback={<div className="animate-pulse bg-white/5 h-screen rounded-2xl" />}>
      <BudgetClient initialData={data as FinanceData} />
    </Suspense>
  );
}
