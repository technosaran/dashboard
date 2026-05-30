import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import BondsClient from "./BondsClient";
import type { Metadata } from "next";
import type { FinanceData } from "@/hooks/use-finance-data";

export const metadata: Metadata = {
  title: "Bonds",
  description:
    "Track your fixed-income securities, coupon payments, and bond portfolio performance.",
};

export const dynamic = "force-dynamic";

export default async function BondsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: initialData } = await supabase.rpc("get_finance_overview_v2");

  return (
    <Suspense fallback={null}>
      <BondsClient initialData={initialData as FinanceData} />
    </Suspense>
  );
}
