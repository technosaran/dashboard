import { Suspense } from "react";

import { createClient } from "@/lib/supabase-server";
import StocksClient from "./StocksClient";
import { redirect } from "next/navigation";
import type { Tables } from "@/lib/database.types";
import { Metadata } from "next";
import type { FinanceData } from "@/hooks/use-finance-data";

export const metadata: Metadata = {
  title: "Stocks",
  description: "Advanced equity tracking with real-time performance analytics.",
};

export type Stock = Tables<"investments">;

export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Prefetch data on server for instant load
  const { data: initialData } = await supabase.rpc("get_finance_overview");

  return (
    <Suspense fallback={null}>
      <StocksClient initialData={initialData as unknown as FinanceData} />
    </Suspense>
  );
}
