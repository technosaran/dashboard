import { Suspense } from "react";

import { createClient } from "@/lib/supabase-server";
import GoalsClient from "./GoalsClient";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Goals | FinanceOS",
  description: "Track and achieve your financial milestones.",
};

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  
  const [{ data: goals }, { data: accounts }] = await Promise.all([
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("name")
  ]);

  return <GoalsClient initialGoals={goals || []} initialAccounts={accounts || []} />;
}
