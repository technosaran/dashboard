import { createClient } from "@/lib/supabase-server";
import IncomeClient from "./IncomeClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function IncomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [incRes, accRes] = await Promise.all([
    supabase
      .from("incomes")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false }),
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("name")
  ]);

  return (
    <IncomeClient 
      initialIncomes={incRes.data || []}
      initialAccounts={accRes.data || []}
    />
  );
}
