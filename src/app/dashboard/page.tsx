import { createClient } from "@/lib/supabase-server";
import type { Tables } from "@/lib/database.types";
import DashboardClient from "./DashboardClient";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your financial command center. Track net worth, cash flow, and portfolio performance at a glance.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardClient />
  );
}
