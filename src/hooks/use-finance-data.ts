"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";

const EMPTY_ARRAY: never[] = [];

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
  fnoTrades: Tables<"fno_trades">[];
};

export type { FinanceData };
export type FnoTrade = Tables<"fno_trades">;
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
    fnoTrades: Tables<"fno_trades">[];
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
    dedupingInterval: 300000, // 5 minutes
    focusThrottleInterval: 300000,
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
      const d = data as FinanceData;
      await Promise.all([
        summarySWR.mutate({
          profile: d.profile,
          accounts: d.accounts,
          transactions: d.transactions,
          ledgerLogs: d.ledgerLogs,
        }, options as Parameters<typeof summarySWR.mutate>[1]),
        investmentsSWR.mutate({
          investments: d.investments,
          mutualFunds: d.mutualFunds,
          bonds: d.bonds,
          alternativeAssets: d.alternativeAssets,
          stockTrades: d.stockTrades,
          mutualFundTrades: d.mutualFundTrades,
          bondTransactions: d.bondTransactions,
          fnoTrades: d.fnoTrades,
        }, options as Parameters<typeof investmentsSWR.mutate>[1]),
        cashflowSWR.mutate({
          incomes: d.incomes,
          expenses: d.expenses,
          budgets: d.budgets,
          goals: d.goals,
          liabilities: d.liabilities,
        }, options as Parameters<typeof cashflowSWR.mutate>[1]),
        forexSWR.mutate({
          forexAccounts: d.forexAccounts,
          forexTrades: d.forexTrades,
          forexTransactions: d.forexTransactions,
        }, options as Parameters<typeof forexSWR.mutate>[1]),
        familySWR.mutate({
          recipients: d.recipients,
        }, options as Parameters<typeof familySWR.mutate>[1]),
      ]);
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
