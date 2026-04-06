"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { searchBanks, type Bank } from "@/lib/banks";

type Account = Tables<"accounts">;
type Transfer = Tables<"transfers"> & { from_account: { name: string }; to_account: { name: string } };
type Deposit = Tables<"deposits"> & { account: { name: string } };

// Fix: hint the FK columns to resolve ambiguous joins
const TRANSFER_SELECT = "*, from_account:accounts!from_account_id(name), to_account:accounts!to_account_id(name)";
const DEPOSIT_SELECT = "*, account:accounts!account_id(name)";

const supabase = createClient();

const TYPE_STYLES: Record<string, { bg: string; badge: string }> = {
  checking:   { bg: "from-blue-600 to-blue-800",       badge: "bg-blue-500/20 text-blue-200" },
  savings:    { bg: "from-emerald-600 to-emerald-800", badge: "bg-emerald-500/20 text-emerald-200" },
  credit:     { bg: "from-rose-600 to-rose-800",       badge: "bg-rose-500/20 text-rose-200" },
  investment: { bg: "from-violet-600 to-violet-800",   badge: "bg-violet-500/20 text-violet-200" },
};

const inputCls = "w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";
const selectCls = "w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500";

function buildChartData(accounts: Account[], deposits: Deposit[]) {
  const now = new Date();
  const currentTotal = accounts.reduce((s, a) => s + a.balance, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const depositsAfter = deposits
      .filter((dep) => new Date(dep.created_at) > d)
      .reduce((s, dep) => s + dep.amount, 0);
    return { date: label, worth: Math.max(0, currentTotal - depositsAfter) };
  });
}
