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
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLInputElement;
      if (
        target &&
        target.tagName === "INPUT" &&
        (target.type === "number" || target.inputMode === "decimal")
      ) {
        // Allowed keys: Backspace, Tab, Enter, Escape, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Delete, Home, End, Period
        const allowedKeys = [
          "Backspace",
          "Tab",
          "Enter",
          "Escape",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Delete",
          "Home",
          "End",
          ".",
        ];

        if (allowedKeys.includes(e.key)) {
          // If decimal point, make sure there isn't already one
          if (e.key === "." && target.value.includes(".")) {
            e.preventDefault();
          }
          return;
        }

        // Allow Ctrl/Cmd combination shortcuts (Copy, Paste, Select All, Cut)
        if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) {
          return;
        }

        // Block everything else that is not a numeric digit
        if (!/^\d$/.test(e.key)) {
          e.preventDefault();
        }
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLInputElement;
      if (
        target &&
        target.tagName === "INPUT" &&
        (target.type === "number" || target.inputMode === "decimal")
      ) {
        const text = e.clipboardData?.getData("text");
        if (text) {
          // Check if pasted text is a valid positive float (only digits and optionally one dot)
          if (!/^\d*\.?\d*$/.test(text)) {
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("paste", handlePaste, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("paste", handlePaste, { capture: true });
    };
  }, []);

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
      }
    : undefined;

  return (
    <SWRConfig value={{ fallback }}>
      <RealtimeSyncProvider>
        {children}
      </RealtimeSyncProvider>
    </SWRConfig>
  );
}
