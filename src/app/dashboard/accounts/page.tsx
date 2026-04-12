import { createClient } from "@/lib/supabase-server";
import AccountsClient from "./AccountsClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch accounts on the server
  let { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Handle auto-creation of Cash account on the server if missing
  if (accounts && !accounts.some(acc => acc.name === "Cash")) {
    const { data: newAccount, error: createError } = await supabase
      .from("accounts")
      .insert({
        user_id: user.id,
        name: "Cash",
        type: "cash",
        balance: 0,
        currency: "INR",
        bank_name: null,
      })
      .select()
      .single();

    if (!createError && newAccount) {
      accounts = [newAccount, ...accounts];
    }
  }

  return (
    <AccountsClient 
      initialAccounts={accounts || []}
    />
  );
}
