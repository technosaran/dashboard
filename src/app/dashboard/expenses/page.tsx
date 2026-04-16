import { Suspense } from "react";

import { createClient } from "@/lib/supabase-server";
import ExpensesClient from "./ExpensesClient";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Expense Management",
  description: "Detailed expenditure tracking. Analyze your spending habits across custom categories and accounts.",
};

export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={null}>
      <ExpensesClient />
    </Suspense>
  );
}
