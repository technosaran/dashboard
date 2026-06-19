import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import MutualFundsClient from "./MutualFundsClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ModuleGuard } from "@/components/module-guard";

export const metadata: Metadata = {
  title: "Mutual Funds",
  description:
    "Advanced mutual fund portfolio management. Track direct schemes, NAV performance, and SIP allocations.",
};

export const dynamic = "force-dynamic";

export default async function MutualFundsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return (
    <Suspense fallback={null}>
      <ModuleGuard moduleKey="Mutual Funds">
        <MutualFundsClient />
      </ModuleGuard>
    </Suspense>
  );
}

