"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { useEffect, useRef, useCallback } from "react";
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
  bonds: Tables<"bonds">[];
  bondTransactions: Tables<"bond_transactions">[];
};

export type { FinanceData };
const FINANCE_DATA_KEY = "finance_overview_data";

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
  const updateQueueRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const swr = useSWR<FinanceData>(FINANCE_DATA_KEY, fetchFinanceData, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 500, // Increased to reduce rapid updates
    errorRetryInterval: 3000,
    errorRetryCount: 3,
    refreshInterval: 0, // Disable polling, rely on realtime
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
      bonds: [],
      bondTransactions: [],
    }
  });

  // Debounced update to batch rapid changes together
  const debouncedMutate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      void mutate(FINANCE_DATA_KEY, undefined, { 
        revalidate: true,
        optimisticData: undefined
      });
      updateQueueRef.current.clear();
      debounceTimerRef.current = null;
    }, 500); // 500ms debounce to batch updates
  }, [mutate]);

  useEffect(() => {
    // Debounced realtime subscription to prevent excessive re-renders
    const handleChange = (table: string) => {
      updateQueueRef.current.add(table);
      debouncedMutate();
    };

    const channel = supabase
      .channel("finance-realtime-instant", {
        config: {
          broadcast: { self: true },
          presence: { key: "" },
        },
      })
      // Financial accounts
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "accounts" 
      }, () => handleChange("accounts"))
      
      // Transactions
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "transactions" 
      }, () => handleChange("transactions"))
      
      // Ledger logs
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "ledger_logs" 
      }, () => handleChange("ledger_logs"))
      
      // Investments
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "investments" 
      }, () => handleChange("investments"))
      
      // Mutual funds
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "mutual_funds" 
      }, () => handleChange("mutual_funds"))
      
      // Goals
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "goals" 
      }, () => handleChange("goals"))
      
      // Recipients
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "recipients" 
      }, () => handleChange("recipients"))
      
      // Incomes
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "incomes" 
      }, () => handleChange("incomes"))
      
      // Expenses
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "expenses" 
      }, () => handleChange("expenses"))
      
      // Stock trades
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "stock_trades" 
      }, () => handleChange("stock_trades"))
      
      // Mutual fund trades
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "mutual_fund_trades" 
      }, () => handleChange("mutual_fund_trades"))
      
      // Transfers
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "transfers" 
      }, () => handleChange("transfers"))
      
      // Bonds
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "bonds" 
      }, () => handleChange("bonds"))
      
      // Bond transactions
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "bond_transactions" 
      }, () => handleChange("bond_transactions"))
      
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Real-time sync active - Zero latency mode");
        }
        if (status === "CHANNEL_ERROR") {
          console.error("❌ Real-time connection error - retrying...");
        }
      });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (channel.state === "joined") {
        void channel.send({
          type: "broadcast",
          event: "heartbeat",
          payload: { timestamp: Date.now() },
        });
      }
    }, 30000); // Every 30 seconds

    return () => {
      clearInterval(heartbeat);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [debouncedMutate]);

  // Handle visibility change for instant sync when returning to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void mutate(FINANCE_DATA_KEY);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [mutate]);

  return {
    ...swr,
    data: swr.data!, 
  };
}
