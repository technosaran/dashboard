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
export const OVERVIEW_KEY = "finance_overview";

async function fetchOverview(): Promise<FinanceData> {
  const { data, error } = await supabase.rpc("get_finance_overview_v2");
  if (error) throw error;
  return data as unknown as FinanceData;
}

export function useFinanceData(initialData?: FinanceData) {
  const fallback: FinanceData = initialData || {
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

  const { data, error, isValidating, mutate } = useSWR<FinanceData>(
    OVERVIEW_KEY,
    fetchOverview,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000, // Reduced to 2 seconds for instant UI response
      fallbackData: initialData
    }
  );

  const mergedData: FinanceData = {
    profile: data?.profile || fallback.profile,
    accounts: data?.accounts || fallback.accounts,
    transactions: data?.transactions || fallback.transactions,
    ledgerLogs: data?.ledgerLogs || fallback.ledgerLogs,
    investments: data?.investments || fallback.investments,
    mutualFunds: data?.mutualFunds || fallback.mutualFunds,
    bonds: data?.bonds || fallback.bonds,
    alternativeAssets: data?.alternativeAssets || fallback.alternativeAssets,
    stockTrades: data?.stockTrades || fallback.stockTrades,
    mutualFundTrades: data?.mutualFundTrades || fallback.mutualFundTrades,
    bondTransactions: data?.bondTransactions || fallback.bondTransactions,
    incomes: data?.incomes || fallback.incomes,
    expenses: data?.expenses || fallback.expenses,
    budgets: data?.budgets || fallback.budgets,
    goals: data?.goals || fallback.goals,
    liabilities: data?.liabilities || fallback.liabilities,
    forexAccounts: data?.forexAccounts || fallback.forexAccounts,
    forexTrades: data?.forexTrades || fallback.forexTrades,
    forexTransactions: data?.forexTransactions || fallback.forexTransactions,
    fnoTrades: data?.fnoTrades || fallback.fnoTrades,
    recipients: data?.recipients || fallback.recipients,
  };

  return {
    data: mergedData,
    isLoading: !data && !error,
    isValidating,
    error,
    mutate
  };
}
