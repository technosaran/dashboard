"use client";

import React from "react";
import { SWRConfig } from "swr";
import { RealtimeSyncProvider } from "./realtime-sync-provider";
import type { FinanceData } from "@/hooks/use-finance-data";
import { OVERVIEW_KEY } from "@/hooks/use-finance-data";

interface SWRProviderProps {
  children: React.ReactNode;
  initialData?: FinanceData;
}

export function SWRProvider({ children, initialData }: SWRProviderProps) {
  const fallback = initialData
    ? {
        [OVERVIEW_KEY]: initialData,
      }
    : {
        [OVERVIEW_KEY]: {
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
        },
      };

  return (
    <SWRConfig value={{ fallback }}>
      <RealtimeSyncProvider>
        {children}
      </RealtimeSyncProvider>
    </SWRConfig>
  );
}
