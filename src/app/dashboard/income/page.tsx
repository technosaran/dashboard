import { Suspense } from "react";

import { createClient } from "@/lib/supabase-server";
import IncomeClient from "./IncomeClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { FinanceData } from "@/hooks/use-finance-data";

export const metadata: Metadata = {
  title: "Income Tracking",
  description: "Monitor your cash flow and earnings. Categorize your revenue sources with precision.",
};

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Prefetch data on server for instant load
  const { data: initialData } = await supabase.rpc("get_finance_overview");

  return (
    <Suspense fallback={null}>
      <IncomeClient initialData={initialData as unknown as FinanceData} />
    </Suspense>
  );
}
