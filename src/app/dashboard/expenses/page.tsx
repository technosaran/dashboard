import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import ExpensesClient from "./ExpensesClient";

export const metadata: Metadata = {
  title: "Expense Tracking",
  description: "Monitor your spending and analyze your monthly expenditure.",
};

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={null}>
      <ExpensesClient />
    </Suspense>
  );
}
