import { createClient } from "@/lib/supabase-server";
import MutualFundsClient from "./MutualFundsClient";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mutual Funds",
  description: "Advanced mutual fund portfolio management. Track direct schemes, NAV performance, and SIP allocations.",
};

export const dynamic = "force-dynamic";

export default async function MutualFundsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  
  const { data: mfs } = await supabase
    .from("mutual_funds")
    .select("*")
    .eq("user_id", user.id)
    .order("fund_name");

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user?.id)
    .order("name");

  return <MutualFundsClient initialIncomes={mfs || []} initialAccounts={accounts || []} />;
}
