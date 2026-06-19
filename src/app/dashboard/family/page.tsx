import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import FamilyClient from "./FamilyClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ModuleGuard } from "@/components/module-guard";

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

  return (
    <Suspense fallback={null}>
      <ModuleGuard moduleKey="Family">
        <FamilyClient />
      </ModuleGuard>
    </Suspense>
  );
}

