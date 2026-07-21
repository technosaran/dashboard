"use client";

import { useState } from "react";
import Image from "next/image";
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

export function getAMCLogoDomain(amcName: string, fundName?: string): { domain: string; badge: string; color: string } {
  const text = `${amcName || ""} ${fundName || ""}`.toLowerCase();
  if (text.includes("uti")) return { domain: "utimf.com", badge: "UTI", color: "from-purple-600 to-indigo-700" };
  if (text.includes("sbi")) return { domain: "sbimf.com", badge: "SBI", color: "from-blue-600 to-cyan-700" };
  if (text.includes("icici")) return { domain: "icicipruamc.com", badge: "ICICI", color: "from-orange-500 to-red-600" };
  if (text.includes("hdfc")) return { domain: "hdfcfund.com", badge: "HDFC", color: "from-red-600 to-rose-700" };
  if (text.includes("axis")) return { domain: "axismf.com", badge: "AXIS", color: "from-rose-700 to-pink-800" };
  if (text.includes("kotak")) return { domain: "kotakmf.com", badge: "KOTAK", color: "from-red-500 to-orange-600" };
  if (text.includes("birla") || text.includes("aditya")) return { domain: "mutualfund.adityabirlacapital.com", badge: "ABSL", color: "from-red-600 to-amber-600" };
  if (text.includes("nippon")) return { domain: "nipponindiaim.com", badge: "NIPPON", color: "from-red-600 to-rose-600" };
  if (text.includes("franklin")) return { domain: "franklintempletonindia.com", badge: "FT", color: "from-teal-600 to-blue-700" };
  if (text.includes("dsp")) return { domain: "dspim.com", badge: "DSP", color: "from-blue-700 to-indigo-800" };
  if (text.includes("mirae")) return { domain: "miraeassetmf.co.in", badge: "MIRAE", color: "from-orange-600 to-amber-700" };
  if (text.includes("parag") || text.includes("ppfas")) return { domain: "amc.ppfas.com", badge: "PPFAS", color: "from-emerald-600 to-teal-700" };
  if (text.includes("motilal")) return { domain: "motilaloswalmf.com", badge: "MO", color: "from-amber-600 to-yellow-700" };
  if (text.includes("tata")) return { domain: "tatamutualfund.com", badge: "TATA", color: "from-blue-600 to-sky-700" };
  if (text.includes("bandhan") || text.includes("idfc")) return { domain: "bandhanmutual.com", badge: "BANDHAN", color: "from-amber-500 to-orange-600" };
  if (text.includes("edelweiss")) return { domain: "edelweissmf.com", badge: "EDEL", color: "from-blue-500 to-indigo-600" };
  if (text.includes("sundaram")) return { domain: "sundarammutual.com", badge: "SUND", color: "from-blue-600 to-blue-800" };
  if (text.includes("quant")) return { domain: "quantmutual.com", badge: "QUANT", color: "from-teal-500 to-emerald-600" };
  if (text.includes("canara")) return { domain: "canararobeco.com", badge: "CANARA", color: "from-blue-700 to-cyan-800" };
  if (text.includes("invesco")) return { domain: "invescomutualfund.com", badge: "INVESCO", color: "from-blue-800 to-indigo-900" };
  if (text.includes("lic")) return { domain: "licmf.com", badge: "LIC", color: "from-yellow-600 to-amber-700" };
  if (text.includes("mahindra")) return { domain: "mahindramanulife.com", badge: "MAH", color: "from-red-600 to-rose-700" };
  if (text.includes("groww")) return { domain: "groww.in", badge: "GROWW", color: "from-emerald-500 to-teal-600" };
  if (text.includes("zerodha")) return { domain: "zerodhafundhouse.com", badge: "ZFH", color: "from-blue-500 to-sky-600" };
  if (text.includes("navi")) return { domain: "navi.com", badge: "NAVI", color: "from-emerald-600 to-green-700" };
  if (text.includes("hsbc")) return { domain: "assetmanagement.hsbc.co.in", badge: "HSBC", color: "from-red-700 to-rose-800" };
  if (text.includes("nj")) return { domain: "njmutualfund.com", badge: "NJ", color: "from-purple-600 to-indigo-700" };
  if (text.includes("white oak") || text.includes("whiteoak")) return { domain: "whiteoakamc.com", badge: "WO", color: "from-slate-700 to-gray-800" };
  if (text.includes("baroda") || text.includes("bnp")) return { domain: "barodabnpparibasmf.in", badge: "BNP", color: "from-emerald-700 to-teal-800" };
  if (text.includes("pgim")) return { domain: "pgimindiamf.com", badge: "PGIM", color: "from-blue-800 to-indigo-900" };
  if (text.includes("boi") || text.includes("bank of india")) return { domain: "boimf.in", badge: "BOI", color: "from-orange-600 to-red-700" };
  
  const defaultBadge = (amcName || fundName || "MF").substring(0, 3).toUpperCase();
  return { domain: "", badge: defaultBadge, color: "from-indigo-600 to-purple-700" };
}

export function AMCAvatar({ amcName, fundName }: { amcName: string; fundName: string }) {
  const [imgStage, setImgStage] = useState<0 | 1 | 2>(0);
  const info = getAMCLogoDomain(amcName, fundName);

  const primaryUrl = info.domain ? `https://logo.clearbit.com/${info.domain}?size=512` : "";
  const secondaryUrl = info.domain ? `https://www.google.com/s2/favicons?domain=${info.domain}&sz=128` : "";

  if (primaryUrl && imgStage === 0) {
    return (
      <Image 
        src={primaryUrl} 
        alt={info.badge} 
        width={40}
        height={40}
        unoptimized
        className="w-10 h-10 rounded-full bg-white object-contain p-1 flex-shrink-0 border border-white/10 shadow-sm"
        onError={() => setImgStage(1)}
      />
    );
  }

  if (secondaryUrl && imgStage === 1) {
    return (
      <Image 
        src={secondaryUrl} 
        alt={info.badge} 
        width={40}
        height={40}
        unoptimized
        className="w-10 h-10 rounded-full bg-white object-contain p-1 flex-shrink-0 border border-white/10 shadow-sm"
        onError={() => setImgStage(2)}
      />
    );
  }

  return (
    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${info.color} border border-white/20 flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-md tracking-tighter`}>
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
    <div className="glass-card-static rounded-2xl overflow-hidden flex flex-col border border-white/5 bg-[var(--bg-card)] w-full">
      <div className="w-full">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-black/40 text-[0.5625rem] sm:text-xs font-black uppercase tracking-[0.15em] text-[--text-muted]">
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
