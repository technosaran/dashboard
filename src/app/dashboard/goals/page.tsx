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
  
  return <GoalsClient />;
}
