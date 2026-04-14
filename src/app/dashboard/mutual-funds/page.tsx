import { Suspense } from "react";

import { createClient } from "@/lib/supabase-server";
import MutualFundsClient from "./MutualFundsClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mutual Funds",
  description: "Advanced mutual fund portfolio management. Track direct schemes, NAV performance, and SIP allocations.",
};

export default async function MutualFundsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
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
