import { createClient } from "@/lib/supabase-server";
import StocksClient from "./StocksClient";
import { redirect } from "next/navigation";
import type { Tables } from "@/lib/database.types";

export type Stock = Tables<"investments">;

export const dynamic = "force-dynamic";

export default async function StocksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: stocks } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", user.id)
    .eq("type", "stock")
    .order("created_at", { ascending: false });

  return (
    <StocksClient
      initialStocks={(stocks as Stock[]) || []}
    />
  );
}
