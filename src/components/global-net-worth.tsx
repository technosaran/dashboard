"use client";

import { useNetWorth } from "@/hooks/use-net-worth";
import { useFinanceData } from "@/hooks/use-finance-data";
import { ArrowUpRight } from "lucide-react";

export function GlobalNetWorth() {
  const { netWorthINR } = useNetWorth();
  const { isLoading } = useFinanceData();

  return (
    <div className="group relative overflow-hidden rounded-[20px] p-[1px] transition-all hover:scale-[1.02] active:scale-[0.98] w-full">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary-light)] via-transparent to-[var(--accent-primary)] opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
      <div className="relative flex flex-col bg-[var(--bg-surface)] backdrop-blur-xl rounded-[19px] px-5 py-4 h-full border border-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent-primary)] rounded-full filter blur-[50px] opacity-10 translate-x-1/2 -translate-y-1/2" />
        
        <div className="flex items-center justify-between mb-1.5 z-10">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)] flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
            Live Net Worth
          </span>
        </div>
        
        <div className="flex items-baseline gap-1.5 z-10">
          <span className="text-base font-bold text-[var(--text-secondary)] opacity-60">₹</span>
          <span className="text-[26px] leading-none font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-white/70">
            {isLoading ? (
              <span className="animate-pulse opacity-50">...</span>
            ) : (
              netWorthINR.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
