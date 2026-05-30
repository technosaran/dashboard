import { Suspense } from "react";
import AlternativeAssetsClient from "./AlternativeAssetsClient";
import { createClient } from "@/lib/supabase-server";
import type { FinanceData } from "@/hooks/use-finance-data";

export const metadata = {
  title: "Alternative Assets | FinanceOS",
  description: "Monitor your physical holdings, real estate, and alternative investments.",
};

export default async function AlternativeAssetsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_finance_overview_v2");

  return (
    <Suspense fallback={<div className="animate-pulse bg-white/5 h-screen rounded-2xl" />}>
      <AlternativeAssetsClient initialData={data as FinanceData} />
    </Suspense>
  );
}
