import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import TransfersClient from "./TransfersClient";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transfers",
  description: "Execute and manage inter-account fund transfers with full audit trail.",
};

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [accRes, transRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("name"),
    supabase
      .from("transfers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
  ]);

  return (
    <Suspense fallback={null}>
      <TransfersClient 
      initialAccounts={accRes.data || []}
      initialTransfers={transRes.data || []}
    />
    </Suspense>
  );
}
