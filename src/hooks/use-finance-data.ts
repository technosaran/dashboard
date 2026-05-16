"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { useEffect, useRef, useCallback } from "react";
import { useSWRConfig } from "swr";
import { useUser } from "@/context/user-context";

const supabase = createClient();

type FinanceData = {
  profile: { username: string; settings: { enabled_modules: string[] } } | null;
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
  forexAccounts: Tables<"forex_accounts">[];
  forexTrades: Tables<"forex_trades">[];
  forexTransactions: Tables<"forex_transactions">[];
  budgets: Tables<"budgets">[];
  alternativeAssets: Tables<"alternative_assets">[];
  liabilities: Tables<"liabilities">[];
};

export type { FinanceData };
const SUMMARY_KEY = "finance_summary";
const INVESTMENTS_KEY = "finance_investments";
const CASHFLOW_KEY = "finance_cashflow";
const FOREX_KEY = "finance_forex";
const FAMILY_KEY = "finance_family";

async function fetchSummary(): Promise<Partial<FinanceData>> {
  const { data, error } = await supabase.rpc("get_summary_v1");
  if (error) throw error;
  return data as unknown as Partial<FinanceData>;
}

async function fetchInvestments(): Promise<Partial<FinanceData>> {
  const { data, error } = await supabase.rpc("get_investments_v1");
  if (error) throw error;
  return data as unknown as Partial<FinanceData>;
}

async function fetchCashflow(): Promise<Partial<FinanceData>> {
  const { data, error } = await supabase.rpc("get_cashflow_v1");
  if (error) throw error;
  return data as unknown as Partial<FinanceData>;
}

async function fetchForex(): Promise<Partial<FinanceData>> {
  const { data, error } = await supabase.rpc("get_forex_v1");
  if (error) throw error;
  return data as unknown as Partial<FinanceData>;
}

async function fetchFamily(): Promise<Partial<FinanceData>> {
  const { data, error } = await supabase.rpc("get_family_v1");
  if (error) throw error;
  return data as unknown as Partial<FinanceData>;
}

export function useFinanceData(initialData?: FinanceData) {
  const { user_id } = useUser();
  const { mutate } = useSWRConfig();
  const updateQueueRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fallback = initialData || {
    profile: null,
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
    forexAccounts: [],
    forexTrades: [],
    forexTransactions: [],
    budgets: [],
    alternativeAssets: [],
    liabilities: [],
  };

  const summarySWR = useSWR(SUMMARY_KEY, fetchSummary, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
    fallbackData: fallback
  });

  const investmentsSWR = useSWR(INVESTMENTS_KEY, fetchInvestments, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000, // Investments change less frequently
    fallbackData: fallback
  });

  const cashflowSWR = useSWR(CASHFLOW_KEY, fetchCashflow, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 4000,
    fallbackData: fallback
  });

  const forexSWR = useSWR(FOREX_KEY, fetchForex, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 1000, // Forex trades can be rapid
    fallbackData: fallback
  });

  const familySWR = useSWR(FAMILY_KEY, fetchFamily, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 10000, // Family info changes rarely
    fallbackData: fallback
  });

  // Debounced update to batch rapid changes together
  const debouncedMutate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      const tables = Array.from(updateQueueRef.current);
      
      // Determine which verticals need revalidation based on changed tables
      if (tables.some(t => ["accounts", "transactions", "ledger_logs", "profiles"].includes(t))) {
        void mutate(SUMMARY_KEY);
      }
      if (tables.some(t => ["investments", "mutual_funds", "bonds", "alternative_assets", "stock_trades", "mutual_fund_trades", "bond_transactions"].includes(t))) {
        void mutate(INVESTMENTS_KEY);
      }
      if (tables.some(t => ["incomes", "expenses", "budgets", "goals", "liabilities"].includes(t))) {
        void mutate(CASHFLOW_KEY);
      }
      if (tables.some(t => ["forex_accounts", "forex_trades", "forex_transactions"].includes(t))) {
        void mutate(FOREX_KEY);
      }
      if (tables.some(t => ["recipients"].includes(t))) {
        void mutate(FAMILY_KEY);
      }
      
      updateQueueRef.current.clear();
      debounceTimerRef.current = null;
    }, 500); 
  }, [mutate]);

  useEffect(() => {
    // Debounced realtime subscription to prevent excessive re-renders
    const handleChange = (table: string) => {
      updateQueueRef.current.add(table);
      debouncedMutate();
    };

    const channelId = Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(`finance-realtime-${channelId}`, {
        config: {
          broadcast: { self: true },
        },
      });

    // Only set up subscriptions if we have a user_id
    if (user_id) {
      channel
        // Financial accounts
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "accounts",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("accounts"))
        
        // Transactions
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "transactions",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("transactions"))
        
        // Ledger logs
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "ledger_logs",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("ledger_logs"))
        
        // Investments
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "investments",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("investments"))
        
        // Mutual funds
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "mutual_funds",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("mutual_funds"))
        
        // Goals
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "goals",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("goals"))
        
        // Recipients
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "recipients",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("recipients"))
        
        // Incomes
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "incomes",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("incomes"))
        
        // Expenses
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "expenses",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("expenses"))
        
        // Stock trades
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "stock_trades",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("stock_trades"))
        
        // Mutual fund trades
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "mutual_fund_trades",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("mutual_fund_trades"))
        
        // Transfers
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "transfers",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("transfers"))
        
        // Bonds
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "bonds",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("bonds"))
        
        // Bond transactions
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "bond_transactions",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("bond_transactions"))
        
        // Forex accounts
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "forex_accounts",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("forex_accounts"))
        
        // Forex trades
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "forex_trades",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("forex_trades"))
        
        // Forex transactions
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "forex_transactions",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("forex_transactions"))
  
        // Budgets
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "budgets",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("budgets"))
  
        // Alternative Assets
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "alternative_assets",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("alternative_assets"))
  
        // Liabilities
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "liabilities",
          filter: `user_id=eq.${user_id}`
        }, () => handleChange("liabilities"))
  
        // Profiles (Settings)
        .on("postgres_changes", { 
          event: "*", 
          schema: "public", 
          table: "profiles",
          filter: `id=eq.${user_id}`
        }, () => handleChange("profiles"));
    }

    channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" && process.env.NODE_ENV !== 'production') {
          console.error("Real-time connection error - retrying...");
        }
      });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [debouncedMutate, user_id]);

  // Handle visibility change for instant sync when returning to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void mutate(SUMMARY_KEY);
        // Only revalidate other segments if they are older than their TTL
        void mutate(INVESTMENTS_KEY);
        void mutate(CASHFLOW_KEY);
        void mutate(FOREX_KEY);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [mutate]);

  // Aggregate the data from all verticals
  const mergedData: FinanceData = {
    profile: summarySWR.data?.profile || fallback.profile,
    accounts: summarySWR.data?.accounts || fallback.accounts,
    transactions: summarySWR.data?.transactions || fallback.transactions,
    ledgerLogs: summarySWR.data?.ledgerLogs || fallback.ledgerLogs,
    
    investments: investmentsSWR.data?.investments || fallback.investments,
    mutualFunds: investmentsSWR.data?.mutualFunds || fallback.mutualFunds,
    bonds: investmentsSWR.data?.bonds || fallback.bonds,
    alternativeAssets: investmentsSWR.data?.alternativeAssets || fallback.alternativeAssets,
    stockTrades: investmentsSWR.data?.stockTrades || fallback.stockTrades,
    mutualFundTrades: investmentsSWR.data?.mutualFundTrades || fallback.mutualFundTrades,
    bondTransactions: investmentsSWR.data?.bondTransactions || fallback.bondTransactions,
    
    incomes: cashflowSWR.data?.incomes || fallback.incomes,
    expenses: cashflowSWR.data?.expenses || fallback.expenses,
    budgets: cashflowSWR.data?.budgets || fallback.budgets,
    goals: cashflowSWR.data?.goals || fallback.goals,
    liabilities: cashflowSWR.data?.liabilities || fallback.liabilities,
    
    forexAccounts: forexSWR.data?.forexAccounts || fallback.forexAccounts,
    forexTrades: forexSWR.data?.forexTrades || fallback.forexTrades,
    forexTransactions: forexSWR.data?.forexTransactions || fallback.forexTransactions,
    
    recipients: familySWR.data?.recipients || fallback.recipients,
  };

  return {
    ...summarySWR,
    data: mergedData,
    isLoading: summarySWR.isLoading || investmentsSWR.isLoading || cashflowSWR.isLoading,
    error: summarySWR.error || investmentsSWR.error || cashflowSWR.error,
    mutate: async (data?: any, options?: any) => {
      // If a callback or data is provided, we apply it to the relevant vertical(s)
      // For this architecture, we focus optimistic updates on the Summary vertical (profiles/accounts)
      if (data !== undefined) {
        await summarySWR.mutate(data, options);
      } else {
        // Full re-fetch of all segments
        await Promise.all([
          summarySWR.mutate(),
          investmentsSWR.mutate(),
          cashflowSWR.mutate(),
          forexSWR.mutate(),
          familySWR.mutate()
        ]);
      }
    }
  };
}
