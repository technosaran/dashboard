import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import ForexClient from "./ForexClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { FinanceData } from "@/hooks/use-finance-data";

export const metadata: Metadata = {
  title: "Forex",
  description: "Track forex trading activity, deposits, withdrawals, and P&L.",
};

export const dynamic = "force-dynamic";

export default async function ForexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: initialData } = await supabase.rpc("get_finance_overview");

  return (
    <Suspense fallback={null}>
      <ForexClient />
    </Suspense>
  );
}
