import { Suspense } from "react";

import { createClient } from "@/lib/supabase-server";
import IncomeClient from "./IncomeClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ModuleGuard } from "@/components/module-guard";

export const metadata: Metadata = {
  title: "Income Tracking",
  description:
    "Monitor your cash flow and earnings. Categorize your revenue sources with precision.",
};

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  return (
    <Suspense fallback={null}>
      <ModuleGuard moduleKey="Income">
        <IncomeClient />
      </ModuleGuard>
    </Suspense>
  );
}

