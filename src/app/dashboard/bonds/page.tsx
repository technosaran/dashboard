import { Suspense } from "react";
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import BondsClient from "./BondsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bonds",
  description:
    "Track your fixed-income securities, coupon payments, and bond portfolio performance.",
};

export const dynamic = "force-dynamic";

export default async function BondsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <Suspense fallback={null}>
      <BondsClient />
    </Suspense>
  );
}
