"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";

export interface FnoTrade {
  id: string;
  user_id: string;
  symbol: string;
  instrument_type: "FUT" | "CE" | "PE";
  strike_price: number | null;
  expiry_date: string;
  trade_type: "BUY" | "SELL";
  quantity: number;
  entry_price: number;
  exit_price: number | null;
  pnl: number | null;
  status: "OPEN" | "CLOSED";
  account_id: string | null;
  ledger_log_id: string | null;
  close_ledger_log_id: string | null;
  notes: string | null;
  trade_date: string;
  close_date: string | null;
  created_at: string;
  updated_at: string;
}

const supabase = createClient();

type FinanceData = {
  profile: { username: string; settings: { enabled_modules: string[]; default_accounts?: Record<string, string | null> } } | null;
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
  fnoTrades: FnoTrade[];
};

export type { FinanceData };
export const SUMMARY_KEY = "finance_summary";
export const INVESTMENTS_KEY = "finance_investments";
export const CASHFLOW_KEY = "finance_cashflow";
export const FOREX_KEY = "finance_forex";
export const FAMILY_KEY = "finance_family";

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
    fnoTrades: [],
  };

  const summarySWR = useSWR(SUMMARY_KEY, fetchSummary, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
    dedupingInterval: 30000,
    revalidateOnMount: false,
    fallbackData: initialData ? {
      profile: initialData.profile,
      accounts: initialData.accounts,
      transactions: initialData.transactions,
      ledgerLogs: initialData.ledgerLogs,
    } : undefined
  });

  const investmentsSWR = useSWR(INVESTMENTS_KEY, fetchInvestments, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
    dedupingInterval: 30000,
    revalidateOnMount: false,
    fallbackData: initialData ? {
      investments: initialData.investments,
      mutualFunds: initialData.mutualFunds,
      bonds: initialData.bonds,
      alternativeAssets: initialData.alternativeAssets,
      stockTrades: initialData.stockTrades,
      mutualFundTrades: initialData.mutualFundTrades,
      bondTransactions: initialData.bondTransactions,
      fnoTrades: initialData.fnoTrades,
    } : undefined
  });

  const cashflowSWR = useSWR(CASHFLOW_KEY, fetchCashflow, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
    dedupingInterval: 30000,
    revalidateOnMount: false,
    fallbackData: initialData ? {
      incomes: initialData.incomes,
      expenses: initialData.expenses,
      budgets: initialData.budgets,
      goals: initialData.goals,
      liabilities: initialData.liabilities,
    } : undefined
  });

  const forexSWR = useSWR(FOREX_KEY, fetchForex, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
    dedupingInterval: 30000,
    revalidateOnMount: false,
    fallbackData: initialData ? {
      forexAccounts: initialData.forexAccounts,
      forexTrades: initialData.forexTrades,
      forexTransactions: initialData.forexTransactions,
    } : undefined
  });

  const familySWR = useSWR(FAMILY_KEY, fetchFamily, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
    dedupingInterval: 30000,
    revalidateOnMount: false,
    fallbackData: initialData ? {
      recipients: initialData.recipients,
    } : undefined
  });

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
    
    fnoTrades: investmentsSWR.data?.fnoTrades || fallback.fnoTrades,
    
    recipients: familySWR.data?.recipients || fallback.recipients,
  };

  return {
    ...summarySWR,
    data: mergedData,
    isLoading: summarySWR.isLoading || investmentsSWR.isLoading || cashflowSWR.isLoading,
    error: summarySWR.error || investmentsSWR.error || cashflowSWR.error,
    mutate: async (data?: unknown, options?: unknown) => {
      // If a callback or data is provided, we apply it to the relevant vertical(s)
      // For this architecture, we focus optimistic updates on the Summary vertical (profiles/accounts)
      if (data !== undefined) {
        await summarySWR.mutate(
          data as Parameters<typeof summarySWR.mutate>[0],
          options as Parameters<typeof summarySWR.mutate>[1]
        );
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
