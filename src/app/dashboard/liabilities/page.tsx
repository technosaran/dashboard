import { Suspense } from "react";
import LiabilitiesClient from "./LiabilitiesClient";

export const metadata = {
  title: "Liabilities & Debt | FinanceOS",
  description: "Track and manage your loans, EMIs, and outstanding debts.",
};

export default async function LiabilitiesPage() {
  return (
    <Suspense fallback={<div className="animate-pulse bg-white/5 h-screen rounded-2xl" />}>
      <LiabilitiesClient />
    </Suspense>
  );
}
