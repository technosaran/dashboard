import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import TransactionsClient from "./TransactionsClient";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Monitor and audit your cash flow, earnings, and expenses in a single place.",
};

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={null}>
      <TransactionsClient />
    </Suspense>
  );
}
