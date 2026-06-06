import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import FamilyClient from "./FamilyClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { FinanceData } from "@/hooks/use-finance-data";

export const metadata: Metadata = {
  title: "Family",
  description:
    "Manage family members and send money to your loved ones securely.",
};

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: initialData } = await supabase.rpc("get_finance_overview_v2");

  return (
    <Suspense fallback={null}>
      <FamilyClient initialData={initialData as FinanceData} />
    </Suspense>
  );
}
