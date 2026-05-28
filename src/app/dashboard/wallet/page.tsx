import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import WalletClient from "./WalletClient";
import { redirect } from "next/navigation";
import type { FinanceData } from "@/hooks/use-finance-data";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mobile Wallet Simulator",
  description:
    "An ultra-premium interactive iOS Apple Wallet simulator inside FinanceOS. Manage passes, custom cards, simulated money transfers and contactless Apple Pay.",
};

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Prefetch overview data on the server
  const { data: initialData } = await supabase.rpc("get_finance_overview");

  return (
    <Suspense fallback={<div className="flex h-[50vh] items-center justify-center text-slate-500 font-medium">Initializing premium Wallet sandbox...</div>}>
      <WalletClient initialData={(initialData as unknown as FinanceData) || undefined} />
    </Suspense>
  );
}
