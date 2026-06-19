"use client";

import React from "react";
import { SWRConfig } from "swr";
import { RealtimeSyncProvider } from "./realtime-sync-provider";
import type { FinanceData } from "@/hooks/use-finance-data";

interface SWRProviderProps {
  children: React.ReactNode;
  initialData?: FinanceData;
}

export function SWRProvider({ children, initialData }: SWRProviderProps) {
  const fallback = initialData
    ? {
        finance_summary: {
          profile: initialData.profile,
          accounts: initialData.accounts,
          transactions: initialData.transactions,
          ledgerLogs: initialData.ledgerLogs,
        },
        finance_investments: {
          investments: initialData.investments,
          mutualFunds: initialData.mutualFunds,
          bonds: initialData.bonds,
          alternativeAssets: initialData.alternativeAssets,
          stockTrades: initialData.stockTrades,
          mutualFundTrades: initialData.mutualFundTrades,
          bondTransactions: initialData.bondTransactions,
          fnoTrades: initialData.fnoTrades || [],
        },
        finance_cashflow: {
          incomes: initialData.incomes,
          expenses: initialData.expenses,
          budgets: initialData.budgets,
          goals: initialData.goals,
          liabilities: initialData.liabilities,
        },
        finance_forex: {
          forexAccounts: initialData.forexAccounts,
          forexTrades: initialData.forexTrades,
          forexTransactions: initialData.forexTransactions,
        },
        finance_family: {
          recipients: initialData.recipients,
        },
      }
    : {
        finance_summary: { profile: null, accounts: [], transactions: [], ledgerLogs: [] },
        finance_investments: { investments: [], mutualFunds: [], bonds: [], alternativeAssets: [], stockTrades: [], mutualFundTrades: [], bondTransactions: [], fnoTrades: [] },
        finance_cashflow: { incomes: [], expenses: [], budgets: [], goals: [], liabilities: [] },
        finance_forex: { forexAccounts: [], forexTrades: [], forexTransactions: [] },
        finance_family: { recipients: [] },
      };

  return (
    <SWRConfig value={{ fallback }}>
      <RealtimeSyncProvider>
        {children}
      </RealtimeSyncProvider>
    </SWRConfig>
  );
}
