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

// Granular Fetcher functions corresponding to database vertical functions
async function fetchSummary() {
  const { data, error } = await supabase.rpc("get_summary_v1");
  if (error) throw error;
  return data as any;
}

async function fetchInvestments() {
  const { data, error } = await supabase.rpc("get_investments_v1");
  if (error) throw error;
  return data as any;
}

async function fetchCashflow() {
  const { data, error } = await supabase.rpc("get_cashflow_v1");
  if (error) throw error;
  return data as any;
}

async function fetchForex() {
  const { data, error } = await supabase.rpc("get_forex_v1");
  if (error) throw error;
  return data as any;
}

async function fetchFamily() {
  const { data, error } = await supabase.rpc("get_family_v1");
  if (error) throw error;
  return data as any;
}

export function useFinanceData(initialData?: FinanceData) {
  const summarySWR = useSWR("finance_summary", fetchSummary, {
    fallbackData: initialData
      ? {
          profile: initialData.profile,
          accounts: initialData.accounts,
          transactions: initialData.transactions,
          ledgerLogs: initialData.ledgerLogs,
        }
      : undefined,
    dedupingInterval: 2000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  const investmentsSWR = useSWR("finance_investments", fetchInvestments, {
    fallbackData: initialData
      ? {
          investments: initialData.investments,
          mutualFunds: initialData.mutualFunds,
          bonds: initialData.bonds,
          alternativeAssets: initialData.alternativeAssets,
          stockTrades: initialData.stockTrades,
          mutualFundTrades: initialData.mutualFundTrades,
          bondTransactions: initialData.bondTransactions,
          fnoTrades: initialData.fnoTrades,
        }
      : undefined,
    dedupingInterval: 2000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  const cashflowSWR = useSWR("finance_cashflow", fetchCashflow, {
    fallbackData: initialData
      ? {
          incomes: initialData.incomes,
          expenses: initialData.expenses,
          budgets: initialData.budgets,
          goals: initialData.goals,
          liabilities: initialData.liabilities,
        }
      : undefined,
    dedupingInterval: 2000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  const forexSWR = useSWR("finance_forex", fetchForex, {
    fallbackData: initialData
      ? {
          forexAccounts: initialData.forexAccounts,
          forexTrades: initialData.forexTrades,
          forexTransactions: initialData.forexTransactions,
        }
      : undefined,
    dedupingInterval: 2000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  const familySWR = useSWR("finance_family", fetchFamily, {
    fallbackData: initialData
      ? {
          recipients: initialData.recipients,
        }
      : undefined,
    dedupingInterval: 2000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  const data: FinanceData = {
    profile: summarySWR.data?.profile ?? null,
    accounts: summarySWR.data?.accounts ?? [],
    transactions: summarySWR.data?.transactions ?? [],
    ledgerLogs: summarySWR.data?.ledgerLogs ?? [],
    investments: investmentsSWR.data?.investments ?? [],
    mutualFunds: investmentsSWR.data?.mutualFunds ?? [],
    bonds: investmentsSWR.data?.bonds ?? [],
    alternativeAssets: investmentsSWR.data?.alternativeAssets ?? [],
    stockTrades: investmentsSWR.data?.stockTrades ?? [],
    mutualFundTrades: investmentsSWR.data?.mutualFundTrades ?? [],
    bondTransactions: investmentsSWR.data?.bondTransactions ?? [],
    fnoTrades: investmentsSWR.data?.fnoTrades ?? [],
    incomes: cashflowSWR.data?.incomes ?? [],
    expenses: cashflowSWR.data?.expenses ?? [],
    budgets: cashflowSWR.data?.budgets ?? [],
    goals: cashflowSWR.data?.goals ?? [],
    liabilities: cashflowSWR.data?.liabilities ?? [],
    forexAccounts: forexSWR.data?.forexAccounts ?? [],
    forexTrades: forexSWR.data?.forexTrades ?? [],
    forexTransactions: forexSWR.data?.forexTransactions ?? [],
    recipients: familySWR.data?.recipients ?? [],
  };

  const isLoading =
    (!summarySWR.data && !summarySWR.error) ||
    (!investmentsSWR.data && !investmentsSWR.error) ||
    (!cashflowSWR.data && !cashflowSWR.error) ||
    (!forexSWR.data && !forexSWR.error) ||
    (!familySWR.data && !familySWR.error);

  const error =
    summarySWR.error ||
    investmentsSWR.error ||
    cashflowSWR.error ||
    forexSWR.error ||
    familySWR.error;

  const isValidating =
    summarySWR.isValidating ||
    investmentsSWR.isValidating ||
    cashflowSWR.isValidating ||
    forexSWR.isValidating ||
    familySWR.isValidating;

  const mutate = async (data?: any, options?: any) => {
    if (data !== undefined) {
      await summarySWR.mutate(data, options);
    } else {
      await Promise.all([
        summarySWR.mutate(),
        investmentsSWR.mutate(),
        cashflowSWR.mutate(),
        forexSWR.mutate(),
        familySWR.mutate(),
      ]);
    }
  };

  return {
    data,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
