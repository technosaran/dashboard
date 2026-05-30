import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import FnoClient from "./FnoClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { FinanceData } from "@/hooks/use-finance-data";

export const metadata: Metadata = {
  title: "FnO Trading",
  description: "Log, track, and audit Futures & Options trades and cash margins.",
};

export const dynamic = "force-dynamic";

export default async function FnoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: initialData } = await supabase.rpc("get_finance_overview_v2");

  return (
    <Suspense fallback={null}>
      <FnoClient initialData={initialData as FinanceData} />
    </Suspense>
  );
}
