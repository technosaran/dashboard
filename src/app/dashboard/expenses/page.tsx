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

  const [expRes, accRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("name")
  ]);

  return (
    <Suspense fallback={null}>
      <ExpensesClient 
      initialExpenses={expRes.data || []}
      initialAccounts={accRes.data || []}
    />
    </Suspense>
  );
}
