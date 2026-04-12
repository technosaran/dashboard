import { createClient } from "@/lib/supabase-server";
import ExpensesClient from "./ExpensesClient";
import { redirect } from "next/navigation";

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
    <ExpensesClient 
      initialExpenses={expRes.data || []}
      initialAccounts={accRes.data || []}
    />
  );
}
