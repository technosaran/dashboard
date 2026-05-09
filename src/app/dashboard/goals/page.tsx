import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import GoalsClient from "./GoalsClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { FinanceData } from "@/hooks/use-finance-data";

export const metadata: Metadata = {
  title: "Goals",
  description: "Track and achieve your financial milestones.",
};

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return (
    <Suspense fallback={null}>
      <GoalsClient />
    </Suspense>
  );
}
