"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase-browser";
import { useUser } from "@/context/user-context";
import { SUMMARY_KEY, INVESTMENTS_KEY, CASHFLOW_KEY, FOREX_KEY, FAMILY_KEY } from "@/hooks/use-finance-data";

const supabase = createClient();

export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const { user_id } = useUser();
  const { mutate } = useSWRConfig();
  const updateQueueRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedMutate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      const tables = Array.from(updateQueueRef.current);
      
      if (tables.some(t => ["accounts", "transactions", "ledger_logs", "profiles"].includes(t))) {
        void mutate(SUMMARY_KEY);
      }
      if (tables.some(t => ["investments", "mutual_funds", "bonds", "alternative_assets", "stock_trades", "mutual_fund_trades", "bond_transactions", "fno_trades"].includes(t))) {
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

    if (user_id) {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${user_id}` }, () => handleChange("accounts"))
        .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user_id}` }, () => handleChange("transactions"))
        .on("postgres_changes", { event: "*", schema: "public", table: "ledger_logs", filter: `user_id=eq.${user_id}` }, () => handleChange("ledger_logs"))
        .on("postgres_changes", { event: "*", schema: "public", table: "investments", filter: `user_id=eq.${user_id}` }, () => handleChange("investments"))
        .on("postgres_changes", { event: "*", schema: "public", table: "mutual_funds", filter: `user_id=eq.${user_id}` }, () => handleChange("mutual_funds"))
        .on("postgres_changes", { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${user_id}` }, () => handleChange("goals"))
        .on("postgres_changes", { event: "*", schema: "public", table: "recipients", filter: `user_id=eq.${user_id}` }, () => handleChange("recipients"))
        .on("postgres_changes", { event: "*", schema: "public", table: "incomes", filter: `user_id=eq.${user_id}` }, () => handleChange("incomes"))
        .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `user_id=eq.${user_id}` }, () => handleChange("expenses"))
        .on("postgres_changes", { event: "*", schema: "public", table: "stock_trades", filter: `user_id=eq.${user_id}` }, () => handleChange("stock_trades"))
        .on("postgres_changes", { event: "*", schema: "public", table: "mutual_fund_trades", filter: `user_id=eq.${user_id}` }, () => handleChange("mutual_fund_trades"))
        .on("postgres_changes", { event: "*", schema: "public", table: "transfers", filter: `user_id=eq.${user_id}` }, () => handleChange("transfers"))
        .on("postgres_changes", { event: "*", schema: "public", table: "bonds", filter: `user_id=eq.${user_id}` }, () => handleChange("bonds"))
        .on("postgres_changes", { event: "*", schema: "public", table: "bond_transactions", filter: `user_id=eq.${user_id}` }, () => handleChange("bond_transactions"))
        .on("postgres_changes", { event: "*", schema: "public", table: "forex_accounts", filter: `user_id=eq.${user_id}` }, () => handleChange("forex_accounts"))
        .on("postgres_changes", { event: "*", schema: "public", table: "forex_trades", filter: `user_id=eq.${user_id}` }, () => handleChange("forex_trades"))
        .on("postgres_changes", { event: "*", schema: "public", table: "forex_transactions", filter: `user_id=eq.${user_id}` }, () => handleChange("forex_transactions"))
        .on("postgres_changes", { event: "*", schema: "public", table: "fno_trades", filter: `user_id=eq.${user_id}` }, () => handleChange("fno_trades"))
        .on("postgres_changes", { event: "*", schema: "public", table: "budgets", filter: `user_id=eq.${user_id}` }, () => handleChange("budgets"))
        .on("postgres_changes", { event: "*", schema: "public", table: "alternative_assets", filter: `user_id=eq.${user_id}` }, () => handleChange("alternative_assets"))
        .on("postgres_changes", { event: "*", schema: "public", table: "liabilities", filter: `user_id=eq.${user_id}` }, () => handleChange("liabilities"))
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user_id}` }, () => handleChange("profiles"));
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

  return <>{children}</>;
}
