"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";

const EMPTY_ARRAY: never[] = [];

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
  profile: { 
    username: string; 
    base_currency: string;
    theme: string;
    timezone: string;
    enabled_modules: string[]; 
    default_accounts?: Record<string, string | null>;
  } | null;
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
  return data;
}

async function fetchInvestments() {
  const { data, error } = await supabase.rpc("get_investments_v1");
  if (error) throw error;
  return data as {
    investments: Tables<"investments">[];
    mutualFunds: Tables<"mutual_funds">[];
    bonds: Tables<"bonds">[];
    alternativeAssets: Tables<"alternative_assets">[];
    stockTrades: Tables<"stock_trades">[];
    mutualFundTrades: Tables<"mutual_fund_trades">[];
    bondTransactions: Tables<"bond_transactions">[];
    fnoTrades: FnoTrade[];
  };
}

async function fetchCashflow() {
  const { data, error } = await supabase.rpc("get_cashflow_v1");
  if (error) throw error;
  return data;
}

async function fetchForex() {
  const { data, error } = await supabase.rpc("get_forex_v1");
  if (error) throw error;
  return data;
}

async function fetchFamily() {
  const { data, error } = await supabase.rpc("get_family_v1");
  if (error) throw error;
  return data;
}

export function useFinanceData(initialData?: FinanceData) {
  const swrOptions = {
    dedupingInterval: 10000, // 10 seconds (up from 2s)
    revalidateOnFocus: false, // Prevents lag when switching tabs
    revalidateOnReconnect: false,
    keepPreviousData: true, // Smoother UI transitions
  };

  const summarySWR = useSWR("finance_summary", fetchSummary, {
    fallbackData: initialData
      ? {
          profile: initialData.profile,
          accounts: initialData.accounts,
          transactions: initialData.transactions,
          ledgerLogs: initialData.ledgerLogs,
        }
      : undefined,
    ...swrOptions,
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
    ...swrOptions,
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
    ...swrOptions,
  });

  const forexSWR = useSWR("finance_forex", fetchForex, {
    fallbackData: initialData
      ? {
          forexAccounts: initialData.forexAccounts,
          forexTrades: initialData.forexTrades,
          forexTransactions: initialData.forexTransactions,
        }
      : undefined,
    ...swrOptions,
  });

  const familySWR = useSWR("finance_family", fetchFamily, {
    fallbackData: initialData
      ? {
          recipients: initialData.recipients,
        }
      : undefined,
    ...swrOptions,
  });

  const data: FinanceData = useMemo(() => ({
    profile: summarySWR.data?.profile ?? null,
    accounts: summarySWR.data?.accounts ?? EMPTY_ARRAY,
    transactions: summarySWR.data?.transactions ?? EMPTY_ARRAY,
    ledgerLogs: summarySWR.data?.ledgerLogs ?? EMPTY_ARRAY,
    investments: investmentsSWR.data?.investments ?? EMPTY_ARRAY,
    mutualFunds: investmentsSWR.data?.mutualFunds ?? EMPTY_ARRAY,
    bonds: investmentsSWR.data?.bonds ?? EMPTY_ARRAY,
    alternativeAssets: investmentsSWR.data?.alternativeAssets ?? EMPTY_ARRAY,
    stockTrades: investmentsSWR.data?.stockTrades ?? EMPTY_ARRAY,
    mutualFundTrades: investmentsSWR.data?.mutualFundTrades ?? EMPTY_ARRAY,
    bondTransactions: investmentsSWR.data?.bondTransactions ?? EMPTY_ARRAY,
    fnoTrades: investmentsSWR.data?.fnoTrades ?? EMPTY_ARRAY,
    incomes: cashflowSWR.data?.incomes ?? EMPTY_ARRAY,
    expenses: cashflowSWR.data?.expenses ?? EMPTY_ARRAY,
    budgets: cashflowSWR.data?.budgets ?? EMPTY_ARRAY,
    goals: cashflowSWR.data?.goals ?? EMPTY_ARRAY,
    liabilities: cashflowSWR.data?.liabilities ?? EMPTY_ARRAY,
    forexAccounts: forexSWR.data?.forexAccounts ?? EMPTY_ARRAY,
    forexTrades: forexSWR.data?.forexTrades ?? EMPTY_ARRAY,
    forexTransactions: forexSWR.data?.forexTransactions ?? EMPTY_ARRAY,
    recipients: familySWR.data?.recipients ?? EMPTY_ARRAY,
  }), [
    summarySWR.data,
    investmentsSWR.data,
    cashflowSWR.data,
    forexSWR.data,
    familySWR.data
  ]);

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

  const mutate = async (
    data?: unknown,
    options?: unknown
  ) => {
    if (data !== undefined) {
      await summarySWR.mutate(
        data as Parameters<typeof summarySWR.mutate>[0],
        options as Parameters<typeof summarySWR.mutate>[1]
      );
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
