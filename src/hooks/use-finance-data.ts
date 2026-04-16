"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { useEffect } from "react";
import { useSWRConfig } from "swr";

const supabase = createClient();

type FinanceData = {
  accounts: Tables<"accounts">[];
  transactions: Tables<"transactions">[];
  ledgerLogs: Tables<"ledger_logs">[];
  investments: Tables<"investments">[];
  mutualFunds: Tables<"mutual_funds">[];
  goals: Tables<"goals">[];
  recipients: Tables<"recipients">[];
  incomes: Tables<"incomes">[];
  expenses: Tables<"expenses">[];
  stockTrades: Tables<"stock_trades">[];
  mutualFundTrades: Tables<"mutual_fund_trades">[];
};

export const FINANCE_DATA_KEY = "finance_overview_data";

async function fetchFinanceData(): Promise<FinanceData> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const [
    accRes, transRes, logRes, invRes, mfRes, goalRes, famRes, incRes, expRes, stRes, mftRes
  ] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id).order("name"),
    supabase.from("transactions").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    supabase.from("ledger_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("investments").select("*").eq("user_id", user.id),
    supabase.from("mutual_funds").select("*").eq("user_id", user.id),
    supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("recipients").select("*").eq("user_id", user.id).order("name"),
    supabase.from("incomes").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    supabase.from("stock_trades").select("*").eq("user_id", user.id).order("trade_date", { ascending: false }).limit(50),
    supabase.from("mutual_fund_trades").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(50),
  ]);

  return {
    accounts: accRes.data || [],
    transactions: transRes.data || [],
    ledgerLogs: logRes.data || [],
    investments: invRes.data || [],
    mutualFunds: mfRes.data || [],
    goals: goalRes.data || [],
    recipients: famRes.data || [],
    incomes: incRes.data || [],
    expenses: expRes.data || [],
    stockTrades: stRes.data || [],
    mutualFundTrades: mftRes.data || [],
  };
}

export function useFinanceData() {
  const { mutate } = useSWRConfig();
  
  const swr = useSWR<FinanceData>(FINANCE_DATA_KEY, fetchFinanceData, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    errorRetryCount: 3,
    fallbackData: {
      accounts: [],
      transactions: [],
      ledgerLogs: [],
      investments: [],
      mutualFunds: [],
      goals: [],
      recipients: [],
      incomes: [],
      expenses: [],
      stockTrades: [],
      mutualFundTrades: [],
    }
  });

  useEffect(() => {
    // Master Realtime Subscription
    const channel = supabase
      .channel("finance-data-master")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => { mutate(FINANCE_DATA_KEY) })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => { mutate(FINANCE_DATA_KEY) })
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger_logs" }, () => { mutate(FINANCE_DATA_KEY) })
      .on("postgres_changes", { event: "*", schema: "public", table: "investments" }, () => { mutate(FINANCE_DATA_KEY) })
      .on("postgres_changes", { event: "*", schema: "public", table: "mutual_funds" }, () => { mutate(FINANCE_DATA_KEY) })
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, () => { mutate(FINANCE_DATA_KEY) })
      .on("postgres_changes", { event: "*", schema: "public", table: "recipients" }, () => { mutate(FINANCE_DATA_KEY) })
      .on("postgres_changes", { event: "*", schema: "public", table: "incomes" }, () => { mutate(FINANCE_DATA_KEY) })
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => { mutate(FINANCE_DATA_KEY) })
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_trades" }, () => { mutate(FINANCE_DATA_KEY) })
      .on("postgres_changes", { event: "*", schema: "public", table: "mutual_fund_trades" }, () => { mutate(FINANCE_DATA_KEY) })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutate]);

  return {
    ...swr,
    data: swr.data!, // Using fallbackData guarantees it's non-null
  };
}
