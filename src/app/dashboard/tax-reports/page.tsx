import { Suspense } from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import TaxReportsClient from "./TaxReportsClient";

export const metadata: Metadata = {
  title: "Tax Studio",
  description: "India-first tax planning center and income tax calculation studio.",
};

export const dynamic = "force-dynamic";

export default async function TaxReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={null}>
      <TaxReportsClient />
    </Suspense>
  );
}
