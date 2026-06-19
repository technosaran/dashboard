import { Suspense } from "react";
import BudgetClient from "./BudgetClient";
import { ModuleGuard } from "@/components/module-guard";

export const metadata = {
  title: "Budget Planner | FinanceOS",
  description: "Strategize your monthly spending and track savings potential.",
};

export default async function BudgetPage() {
  return (
    <Suspense fallback={<div className="animate-pulse bg-white/5 h-screen rounded-2xl" />}>
      <ModuleGuard moduleKey="Budget">
        <BudgetClient />
      </ModuleGuard>
    </Suspense>
  );
}

