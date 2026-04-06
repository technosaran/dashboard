"use client";

import { useEffect, useState } from "react";
import Greeting from "@/components/greeting";
import { createClient } from "@/lib/supabase-browser";

export default function DashboardPage() {
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accountCount, setAccountCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    loadTotalBalance();

    // Subscribe to account changes
    const channel = supabase
      .channel("dashboard-accounts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts" },
        () => {
          loadTotalBalance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadTotalBalance() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: accounts } = await supabase
      .from("accounts")
      .select("balance")
      .eq("user_id", user.id);

    if (accounts) {
      const total = accounts.reduce((sum, acc) => sum + acc.balance, 0);
      setTotalBalance(total);
      setAccountCount(accounts.length);
    }
    setLoading(false);
  }

  return (
    <div>
      <Greeting />
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Here&apos;s your financial overview.
      </p>

      <div className="mt-8">
        <div className="rounded-2xl bg-emerald-500 p-6 text-white shadow-lg shadow-emerald-200 dark:shadow-none max-w-sm">
          <p className="text-sm font-medium text-emerald-100">Total Net Worth</p>
          {loading ? (
            <p className="mt-3 text-4xl font-bold tracking-tight">Loading...</p>
          ) : (
            <>
              <p className="mt-3 text-4xl font-bold tracking-tight">
                ₹{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-2 text-xs text-emerald-200">
                {accountCount} {accountCount === 1 ? "account" : "accounts"} • Updated just now
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
