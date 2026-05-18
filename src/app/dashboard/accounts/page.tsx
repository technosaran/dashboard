import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import AccountsClient from "./AccountsClient";
import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accounts",
  description:
    "Monitor and manage your bank accounts, wallets, and cash reserves in real-time.",
};

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={null}>
      <AccountsClient />
    </Suspense>
  );
}
