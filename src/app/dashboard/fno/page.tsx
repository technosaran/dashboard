import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import FnoClient from "./FnoClient";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FnO Trading",
  description: "Log, track, and audit Futures & Options trades and cash margins.",
};

export const dynamic = "force-dynamic";

export default async function FnoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <Suspense fallback={null}>
      <FnoClient />
    </Suspense>
  );
}
