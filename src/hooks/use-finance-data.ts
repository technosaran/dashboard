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

export type { FinanceData };
export const FINANCE_DATA_KEY = "finance_overview_data";

let mutateTimeout: ReturnType<typeof setTimeout> | null = null;

async function fetchFinanceData(): Promise<FinanceData> {
  const { data, error } = await supabase.rpc("get_finance_overview");
  
  if (error) {
    console.error("Finance Data Fetch Error:", error);
    throw error;
  }

  return data as FinanceData;
}

export function useFinanceData(initialData?: FinanceData) {
  const { mutate } = useSWRConfig();

  const swr = useSWR<FinanceData>(FINANCE_DATA_KEY, fetchFinanceData, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 3000, 
    errorRetryInterval: 5000,
    errorRetryCount: 3,
    fallbackData: initialData || {
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
    // Master Realtime Subscription with Debounced Revalidation
    const debouncedMutate = () => {
      if (mutateTimeout) clearTimeout(mutateTimeout);
      mutateTimeout = setTimeout(() => {
        void mutate(FINANCE_DATA_KEY);
      }, 400); 
    };

    const channel = supabase
      .channel("finance-data-master")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, debouncedMutate)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, debouncedMutate)
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger_logs" }, debouncedMutate)
      .on("postgres_changes", { event: "*", schema: "public", table: "investments" }, debouncedMutate)
      .on("postgres_changes", { event: "*", schema: "public", table: "mutual_funds" }, debouncedMutate)
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, debouncedMutate)
      .on("postgres_changes", { event: "*", schema: "public", table: "recipients" }, debouncedMutate)
      .on("postgres_changes", { event: "*", schema: "public", table: "incomes" }, debouncedMutate)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, debouncedMutate)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_trades" }, debouncedMutate)
      .on("postgres_changes", { event: "*", schema: "public", table: "mutual_fund_trades" }, debouncedMutate)
      .subscribe();

    return () => {
      if (mutateTimeout) clearTimeout(mutateTimeout);
      void supabase.removeChannel(channel);
    };
  }, [mutate]);

  return {
    ...swr,
    data: swr.data!, 
  };
}
