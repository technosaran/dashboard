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

function getAMCLogoUrl(amcName: string): string {
  const amc = (amcName || "").toLowerCase();
  if (amc.includes('hdfc')) return 'https://logo.clearbit.com/hdfcfund.com';
  if (amc.includes('sbi')) return 'https://logo.clearbit.com/sbimf.com';
  if (amc.includes('icici')) return 'https://logo.clearbit.com/icicipruamc.com';
  if (amc.includes('axis')) return 'https://logo.clearbit.com/axismf.com';
  if (amc.includes('kotak')) return 'https://logo.clearbit.com/kotakmf.com';
  if (amc.includes('aditya birla') || amc.includes('birla')) return 'https://logo.clearbit.com/mutualfund.adityabirlacapital.com';
  if (amc.includes('nippon')) return 'https://logo.clearbit.com/nipponindiaim.com';
  if (amc.includes('franklin')) return 'https://logo.clearbit.com/franklintempletonindia.com';
  if (amc.includes('dsp')) return 'https://logo.clearbit.com/dspim.com';
  if (amc.includes('mirae')) return 'https://logo.clearbit.com/miraeassetmf.co.in';
  if (amc.includes('parag parikh') || amc.includes('ppfas')) return 'https://logo.clearbit.com/amc.ppfas.com';
  if (amc.includes('motilal')) return 'https://logo.clearbit.com/motilaloswalmf.com';
  if (amc.includes('tata')) return 'https://logo.clearbit.com/tatamutualfund.com';
  if (amc.includes('uti')) return 'https://logo.clearbit.com/utimf.com';
  if (amc.includes('bandhan') || amc.includes('idfc')) return 'https://logo.clearbit.com/bandhanmutual.com';
  if (amc.includes('edelweiss')) return 'https://logo.clearbit.com/edelweissmf.com';
  if (amc.includes('sundaram')) return 'https://logo.clearbit.com/sundarammutual.com';
  if (amc.includes('quant')) return 'https://logo.clearbit.com/quantmutual.com';
  if (amc.includes('canara')) return 'https://logo.clearbit.com/canararobeco.com';
  if (amc.includes('invesco')) return 'https://logo.clearbit.com/invescomutualfund.com';
  if (amc.includes('lic')) return 'https://logo.clearbit.com/licmf.com';
  if (amc.includes('mahindra')) return 'https://logo.clearbit.com/mahindramanulife.com';
  if (amc.includes('union')) return 'https://logo.clearbit.com/unionmf.com';
  if (amc.includes('taurus')) return 'https://logo.clearbit.com/taurusmutualfund.com';
  if (amc.includes('navi')) return 'https://logo.clearbit.com/navi.com';
  if (amc.includes('groww')) return 'https://logo.clearbit.com/groww.in';
  return '';
}

function AMCAvatar({ amcName, logoUrl }: { amcName: string; logoUrl: string }) {
  const [error, setError] = useState(false);
  const initials = amcName.substring(0, 2).toUpperCase();
  if (logoUrl && !error) {
    return (
      <Image 
        src={logoUrl} 
        alt={amcName} 
        width={40}
        height={40}
        className="w-10 h-10 rounded-full bg-white object-contain flex-shrink-0 border border-white/10"
        onError={() => setError(true)}
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-semibold text-gray-300 flex-shrink-0">
      {initials}
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
    <div className="glass-card-static rounded-2xl overflow-hidden flex flex-col border border-white/5 bg-[#151515] w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-white/5 bg-black/40 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
              <th className="px-5 py-4">Fund Name</th>
              <th className="px-5 py-4 text-center">Type</th>
              <th className="px-5 py-4 text-right">Units</th>
              <th className="px-5 py-4 text-right">Avg. NAV</th>
              <th className="px-5 py-4 text-right">Current NAV</th>
              <th className="px-5 py-4 text-right">Invested Value</th>
              <th className="px-5 py-4 text-right">Current Value</th>
              <th className="px-5 py-4 text-right">P&L / Return</th>
              <th className="px-5 py-4 text-right">Actions</th>
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
              const logo = getAMCLogoUrl(amc);

              return (
                <tr key={fund.id} className="hover:bg-white/[0.02] transition-colors group">
                  {/* Fund Name */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <AMCAvatar amcName={amc} logoUrl={logo} />
                      <div className="min-w-0">
                        <span className="text-[13px] font-bold text-white block truncate max-w-[250px]" title={fund.fund_name}>
                          {fund.fund_name}
                        </span>
                        <span className="text-[8px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider mt-1 inline-block">
                          {fund.category || "Equity"}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="px-5 py-3.5 text-center">
                    <span className="text-[8px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                      {fund.investment_type || "SIP"}
                    </span>
                  </td>

                  {/* Units */}
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-white">
                    {Number(fund.units).toFixed(3)}
                  </td>

                  {/* Avg NAV */}
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-[--text-secondary]">
                    ₹{formatMoney(Number(fund.avg_nav))}
                  </td>

                  {/* Current NAV */}
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-white">
                    ₹{formatMoney(Number(fund.current_nav))}
                  </td>

                  {/* Invested Value */}
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-[--text-secondary]">
                    ₹{formatMoney(invested)}
                  </td>

                  {/* Current Value */}
                  <td className="px-5 py-3.5 text-right font-mono text-xs text-white font-bold">
                    ₹{formatMoney(current)}
                  </td>

                  {/* P&L */}
                  <td className="px-5 py-3.5 text-right">
                    <div 
                      className="text-xs font-black inline-flex flex-col items-end"
                      style={{
                        color: isPositive ? '#34d399' : '#f87171',
                        textShadow: isPositive ? '0 0 8px rgba(52,211,153,0.35)' : '0 0 8px rgba(248,113,113,0.35)'
                      }}
                    >
                      <span>{isPositive ? '+' : ''}₹{formatMoney(pnl)}</span>
                      <span className="text-[10px] opacity-80 mt-0.5">{isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(fund)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
                        title="Edit details"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onBuy(fund)}
                        className="px-2 py-1 rounded bg-[--accent-primary]/10 hover:bg-[--accent-primary] text-[--accent-primary] hover:text-white transition-all text-[9px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        Buy
                      </button>
                      <button
                        onClick={() => onSell(fund)}
                        className="px-2 py-1 rounded border border-rose-500/30 hover:bg-rose-500 text-rose-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-wider cursor-pointer"
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
              <td className="px-5 py-4 text-white uppercase tracking-wider" colSpan={5}>Total Holdings ({funds.length})</td>
              <td className="px-5 py-4 text-right font-mono text-white">₹{formatMoney(totalInvested)}</td>
              <td className="px-5 py-4 text-right font-mono text-white">₹{formatMoney(totalCurrent)}</td>
              <td className="px-5 py-4 text-right">
                <div 
                  className="font-mono font-black inline-flex flex-col items-end"
                  style={{
                    color: totalPnL >= 0 ? '#34d399' : '#f87171',
                    textShadow: totalPnL >= 0 ? '0 0 10px rgba(52,211,153,0.4)' : '0 0 10px rgba(248,113,113,0.4)'
                  }}
                >
                  <span>{totalPnL >= 0 ? '+' : ''}₹{formatMoney(totalPnL)}</span>
                  <span className="text-[10px] opacity-80 mt-0.5">{totalPnL >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%</span>
                </div>
              </td>
              <td className="px-5 py-4"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
