import { createClient } from "@/lib/supabase-server";
import GoalsClient from "./GoalsClient";
import { redirect } from "next/navigation";
import type { FinanceData } from "@/hooks/use-finance-data";

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

  // Prefetch data on server for instant load
  const { data: initialData } = await supabase.rpc("get_finance_overview");
  
  return <GoalsClient initialData={initialData as unknown as FinanceData} />;
}
