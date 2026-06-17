"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { createClient } from "@/lib/supabase-browser";
import { useUser } from "@/context/user-context";


export function RealtimeSyncProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());

  const { user_id } = useUser();
  const { mutate } = useSWRConfig();
  const updateQueueRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedMutate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      // Mutate only the specific SWR keys that were queued
      updateQueueRef.current.forEach((key) => {
        void mutate(key);
      });
      updateQueueRef.current.clear();
      debounceTimerRef.current = null;
    }, 100); // Debounce duration reduced to 100ms for instant real-time response
  }, [mutate]);

  useEffect(() => {
    const handleChange = (table: string) => {
      let key = "finance_summary";
      if (["investments", "mutual_funds", "bonds", "alternative_assets", "stock_trades", "mutual_fund_trades", "bond_transactions", "fno_trades"].includes(table)) {
        key = "finance_investments";
      } else if (["incomes", "expenses", "budgets", "goals", "liabilities"].includes(table)) {
        key = "finance_cashflow";
      } else if (["forex_accounts", "forex_trades", "forex_transactions"].includes(table)) {
        key = "finance_forex";
      } else if (["recipients"].includes(table)) {
        key = "finance_family";
      } else if (table === "transfers") {
        key = "finance_summary";
      }
      
      updateQueueRef.current.add(key);
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
  }, [debouncedMutate, user_id, supabase]);

  return <>{children}</>;
}
