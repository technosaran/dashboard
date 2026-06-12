"use client";

import React from "react";
import { SWRConfig } from "swr";
import { RealtimeSyncProvider } from "./realtime-sync-provider";
import type { FinanceData } from "@/hooks/use-finance-data";
import {
  SUMMARY_KEY,
  INVESTMENTS_KEY,
  CASHFLOW_KEY,
  FOREX_KEY,
  FAMILY_KEY,
} from "@/hooks/use-finance-data";

interface SWRProviderProps {
  children: React.ReactNode;
  initialData?: FinanceData;
}

export function SWRProvider({ children, initialData }: SWRProviderProps) {
  const fallback = initialData
    ? {
        [SUMMARY_KEY]: {
          profile: initialData.profile,
          accounts: initialData.accounts,
          transactions: initialData.transactions,
          ledgerLogs: initialData.ledgerLogs,
        },
        [INVESTMENTS_KEY]: {
          investments: initialData.investments,
          mutualFunds: initialData.mutualFunds,
          bonds: initialData.bonds,
          alternativeAssets: initialData.alternativeAssets,
          stockTrades: initialData.stockTrades,
          mutualFundTrades: initialData.mutualFundTrades,
          bondTransactions: initialData.bondTransactions,
          fnoTrades: initialData.fnoTrades,
        },
        [CASHFLOW_KEY]: {
          incomes: initialData.incomes,
          expenses: initialData.expenses,
          budgets: initialData.budgets,
          goals: initialData.goals,
          liabilities: initialData.liabilities,
        },
        [FOREX_KEY]: {
          forexAccounts: initialData.forexAccounts,
          forexTrades: initialData.forexTrades,
          forexTransactions: initialData.forexTransactions,
        },
        [FAMILY_KEY]: {
          recipients: initialData.recipients,
        },
      }
    : {
        [SUMMARY_KEY]: { profile: null, accounts: [], transactions: [], ledgerLogs: [] },
        [INVESTMENTS_KEY]: { investments: [], mutualFunds: [], bonds: [], alternativeAssets: [], stockTrades: [], mutualFundTrades: [], bondTransactions: [], fnoTrades: [] },
        [CASHFLOW_KEY]: { incomes: [], expenses: [], budgets: [], goals: [], liabilities: [] },
        [FOREX_KEY]: { forexAccounts: [], forexTrades: [], forexTransactions: [] },
        [FAMILY_KEY]: { recipients: [] },
      };

  return (
    <SWRConfig value={{ fallback }}>
      <RealtimeSyncProvider>
        {children}
      </RealtimeSyncProvider>
    </SWRConfig>
  );
}
