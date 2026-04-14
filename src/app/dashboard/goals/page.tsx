
import { createClient } from "@/lib/supabase-server";
import GoalsClient from "./GoalsClient";
import type { Tables } from "@/lib/database.types";

export const metadata = {
  title: "Goals | FinanceOS",
  description: "Track and achieve your financial milestones.",
};

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return <GoalsClient initialGoals={goals || []} />;
}
