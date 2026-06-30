import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import IncomeClient from "./IncomeClient";

export const metadata: Metadata = {
  title: "Income Strategy",
  description: "Monitor your revenue streams and track financial growth.",
};

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={null}>
      <IncomeClient />
    </Suspense>
  );
}
