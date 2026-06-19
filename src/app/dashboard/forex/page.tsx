import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import ForexClient from "./ForexClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ModuleGuard } from "@/components/module-guard";

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

  return (
    <Suspense fallback={null}>
      <ModuleGuard moduleKey="Forex">
        <ForexClient />
      </ModuleGuard>
    </Suspense>
  );
}

