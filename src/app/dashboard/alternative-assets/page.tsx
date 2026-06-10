import { Suspense } from "react";
import AlternativeAssetsClient from "./AlternativeAssetsClient";

export const metadata = {
  title: "Alternative Assets | FinanceOS",
  description: "Monitor your physical holdings, real estate, and alternative investments.",
};

export default async function AlternativeAssetsPage() {
  return (
    <Suspense fallback={<div className="animate-pulse bg-white/5 h-screen rounded-2xl" />}>
      <AlternativeAssetsClient />
    </Suspense>
  );
}
