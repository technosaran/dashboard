import { Suspense } from "react";

import { createClient } from "@/lib/supabase-server";
import StocksClient from "./StocksClient";
import { redirect } from "next/navigation";
import type { Tables } from "@/lib/database.types";
import type { Metadata } from "next";
import { ModuleGuard } from "@/components/module-guard";

export const metadata: Metadata = {
  title: "Stocks",
  description: "Advanced equity tracking with real-time performance analytics.",
};

export type Stock = Tables<"investments">;

export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  return (
    <Suspense fallback={null}>
      <ModuleGuard moduleKey="Stocks">
        <StocksClient />
      </ModuleGuard>
    </Suspense>
  );
}

