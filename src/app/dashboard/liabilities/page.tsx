import { Suspense } from "react";
import LiabilitiesClient from "./LiabilitiesClient";
import { ModuleGuard } from "@/components/module-guard";

export const metadata = {
  title: "Liabilities & Debt",
  description: "Track and manage your loans, EMIs, and outstanding debts.",
};

export default async function LiabilitiesPage() {
  return (
    <Suspense fallback={<div className="animate-pulse bg-white/5 h-screen rounded-2xl" />}>
      <ModuleGuard moduleKey="Liabilities">
        <LiabilitiesClient />
      </ModuleGuard>
    </Suspense>
  );
}

