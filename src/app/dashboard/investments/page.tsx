import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import InvestmentsClient from "./InvestmentsClient";

export const metadata: Metadata = {
  title: "Investments Portfolio",
  description: "Unified tracking of stocks, mutual funds, bonds, and F&O derivatives.",
};

export const dynamic = "force-dynamic";

export default async function InvestmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={null}>
      <InvestmentsClient />
    </Suspense>
  );
}
