/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import type { Tables } from "@/lib/database.types";

type MF = Tables<"mutual_funds"> & { scheme_code?: string | null; fund_symbol?: string | null; pnlPercent?: number; day_change?: number; day_change_percent?: number };

interface MutualFundsDataTableProps {
  funds: MF[];
  onEdit: (fund: MF) => void;
  onBuy: (fund: MF) => void;
  onSell: (fund: MF) => void;
  onAdd: () => void;
}

import { getAMCLogoInfo } from "@/lib/amc-logos";

export function AMCAvatar({ amcName, fundName }: { amcName: string; fundName: string }) {
  const [imgStage, setImgStage] = useState<0 | 1 | 2 | 3>(0);
  const info = getAMCLogoInfo(amcName, fundName);

  const logoUrl = info.logoUrl;
  const unavatarUrl = info.fallbackLogoUrl;
  const clearbitUrl = info.domain ? `https://logo.clearbit.com/${info.domain}?size=512` : "";

  if (logoUrl && imgStage === 0) {
    return (
      <img 
        src={logoUrl} 
        alt={info.badge} 
        className="w-10 h-10 rounded-full bg-white object-contain p-1 flex-shrink-0 border border-white/10 shadow-md"
        onError={() => setImgStage(1)}
      />
    );
  }

  if (unavatarUrl && imgStage === 1) {
    return (
      <img 
        src={unavatarUrl} 
        alt={info.badge} 
        className="w-10 h-10 rounded-full bg-white object-contain p-1 flex-shrink-0 border border-white/10 shadow-md"
        onError={() => setImgStage(2)}
      />
    );
  }

  if (clearbitUrl && imgStage === 2) {
    return (
      <img 
        src={clearbitUrl} 
        alt={info.badge} 
        className="w-10 h-10 rounded-full bg-white object-contain p-1 flex-shrink-0 border border-white/10 shadow-md"
        onError={() => setImgStage(3)}
      />
    );
  }

  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${info.gradientColor} border border-white/20 flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-md tracking-tighter`}>
      {info.badge}
    </div>
  );
}

export default function MutualFundsDataTable({ funds, onEdit, onBuy, onSell, onAdd }: MutualFundsDataTableProps) {


  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });



  if (funds.length === 0) {
    return (
      <EmptyState 
        icon="📈"
        title="No investments"
        description="You haven't invested in any mutual funds yet."
        action={
          <button onClick={onAdd} className="btn-primary">
            Explore funds
          </button>
        }
      />
    );
  }

  const totalInvested = funds.reduce((sum, f) => sum + (Number(f.units) * Number(f.avg_nav)), 0);
  const totalCurrent = funds.reduce((sum, f) => sum + (Number(f.units) * Number(f.current_nav)), 0);
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="glass-card-static rounded-3xl overflow-hidden flex flex-col border border-white/10 bg-white/[0.02] backdrop-blur-2xl shadow-2xl w-full relative">
      <div className="w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-black/60 backdrop-blur-md text-[0.5625rem] sm:text-xs font-extrabold uppercase tracking-[0.15em] text-gray-400">
              <th className="px-3 sm:px-4 py-3.5">Fund Name</th>
              <th className="px-2 sm:px-3 py-3.5 text-center">Type</th>
              <th className="px-2 sm:px-3 py-3.5 text-right">Units</th>
              <th className="px-2 sm:px-3 py-3.5 text-right">Avg. NAV</th>
              <th className="px-2 sm:px-3 py-3.5 text-right">Current NAV</th>
              <th className="px-2 sm:px-3 py-3.5 text-right">Invested Value</th>
              <th className="px-2 sm:px-3 py-3.5 text-right">Current Value</th>
              <th className="px-3 sm:px-4 py-3.5 text-right">P&L / Return</th>
              <th className="px-3 sm:px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {funds.map((fund) => {
              const invested = Number(fund.units) * Number(fund.avg_nav);
              const current = Number(fund.units) * Number(fund.current_nav);
              const pnl = current - invested;
              const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
              const isPositive = pnl >= 0;

              const amc = fund.amc_name || "";

              return (
                <tr key={fund.id}>
                  {/* Fund Name */}
                  <td className="px-3 sm:px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <AMCAvatar amcName={amc} fundName={fund.fund_name} />
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-white block truncate max-w-[180px] lg:max-w-[260px]" title={fund.fund_name}>
                          {fund.fund_name}
                        </span>
                        <span className="text-[0.5625rem] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider mt-1 inline-block">
                          {fund.category || "Equity"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-2 sm:px-3 py-3 text-center">
                    <span className="text-[0.5625rem] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 sm:px-2 py-0.5 rounded uppercase tracking-wider">
                      {fund.investment_type || "SIP"}
                    </span>
                  </td>

                  {/* Units */}
                  <td className="px-2 sm:px-3 py-3 text-right font-mono text-xs text-white">
                    {Number(fund.units).toFixed(3)}
                  </td>

                  {/* Avg NAV */}
                  <td className="px-2 sm:px-3 py-3 text-right font-mono text-xs text-[--text-secondary]">
                    ₹{formatMoney(Number(fund.avg_nav))}
                  </td>

                  {/* Current NAV */}
                  <td className="px-2 sm:px-3 py-3 text-right font-mono text-xs text-white">
                    ₹{formatMoney(Number(fund.current_nav))}
                  </td>

                  {/* Invested Value */}
                  <td className="px-2 sm:px-3 py-3 text-right font-mono text-xs text-[--text-secondary]">
                    ₹{formatMoney(invested)}
                  </td>

                  {/* Current Value */}
                  <td className="px-2 sm:px-3 py-3 text-right font-mono text-xs text-white font-bold">
                    ₹{formatMoney(current)}
                  </td>

                  {/* P&L */}
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <div 
                      className="text-xs font-black inline-flex flex-col items-end"
                      style={{
                        color: isPositive ? '#34d399' : '#f87171',
                        textShadow: isPositive ? '0 0 8px rgba(52,211,153,0.35)' : '0 0 8px rgba(248,113,113,0.35)'
                      }}
                    >
                      <span>{isPositive ? '+' : ''}₹{formatMoney(pnl)}</span>
                      <span className="text-xs opacity-80 mt-0.5">{isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-3 sm:px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(fund)}
                        className="p-1 sm:p-1.5 rounded-lg bg-white/5 text-xs font-bold text-gray-300 cursor-pointer"
                        title="Edit details"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onBuy(fund)}
                        className="px-1.5 sm:px-2 py-1 rounded bg-[--accent-primary]/10 text-[--accent-primary] text-[0.5625rem] font-black uppercase tracking-wider cursor-pointer"
                      >
                        Buy
                      </button>
                      <button
                        onClick={() => onSell(fund)}
                        className="px-1.5 sm:px-2 py-1 rounded border border-rose-500/30 text-rose-400 text-[0.5625rem] font-black uppercase tracking-wider cursor-pointer"
                      >
                        Redeem
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          
          {/* Zerodha-Style Summary Row */}
          <tfoot>
            <tr className="border-t-2 border-white/10 bg-black/60 font-black text-xs">
              <td className="px-3 sm:px-4 py-3.5 text-white uppercase tracking-wider" colSpan={5}>Total Holdings ({funds.length})</td>
              <td className="px-2 sm:px-3 py-3.5 text-right font-mono text-white">₹{formatMoney(totalInvested)}</td>
              <td className="px-2 sm:px-3 py-3.5 text-right font-mono text-white">₹{formatMoney(totalCurrent)}</td>
              <td className="px-3 sm:px-4 py-3.5 text-right">
                <div 
                  className="font-mono font-black inline-flex flex-col items-end"
                  style={{
                    color: totalPnL >= 0 ? '#34d399' : '#f87171',
                    textShadow: totalPnL >= 0 ? '0 0 10px rgba(52,211,153,0.4)' : '0 0 10px rgba(248,113,113,0.4)'
                  }}
                >
                  <span>{totalPnL >= 0 ? '+' : ''}₹{formatMoney(totalPnL)}</span>
                  <span className="text-xs opacity-80 mt-0.5">{totalPnL >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%</span>
                </div>
              </td>
              <td className="px-3 sm:px-4 py-3.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
