
import { createClient } from "@/lib/supabase-server";
import LedgerClient from "./LedgerClient";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ledger",
  description: "Comprehensive financial audit trail. View every transaction, balance change, and account adjustment in detail.",
};

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <LedgerClient />;
}
