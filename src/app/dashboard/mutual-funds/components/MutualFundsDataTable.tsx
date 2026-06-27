"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import type { Tables } from "@/lib/database.types";

type MF = Tables<"mutual_funds"> & { scheme_code?: string | null; fund_symbol?: string | null; pnlPercent?: number; day_change?: number; day_change_percent?: number };

interface MutualFundsDataTableProps {
  funds: MF[];
  onEdit: (fund: MF) => void;
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
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img 
        src={logoUrl} 
        alt={amcName} 
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

export default function MutualFundsDataTable({ funds, onEdit, onSell, onAdd }: MutualFundsDataTableProps) {
  const [globalFilter, setGlobalFilter] = useState("");

  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const filteredFunds = useMemo(() => {
    if (!globalFilter) return funds;
    const lower = globalFilter.toLowerCase();
    return funds.filter(f => 
      f.fund_name.toLowerCase().includes(lower) || 
      (f.amc_name && f.amc_name.toLowerCase().includes(lower)) ||
      (f.category && f.category.toLowerCase().includes(lower))
    );
  }, [funds, globalFilter]);

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

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            placeholder="Search your investments (e.g. HDFC, Equity)"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full bg-[#151515] border border-white/10 rounded px-4 py-2 text-xs text-white placeholder-gray-500 focus:border-[#2185d0] outline-none"
          />
        </div>
      </div>
      {/* Table (Zerodha Coin Style) */}
      <div className="glass-card-static rounded-2xl overflow-hidden flex flex-col border border-white/5 bg-[#151515]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-white/5 bg-black/40 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                <th className="px-6 py-4">Scheme / Fund Name</th>
                <th className="px-6 py-4 text-right">Units</th>
                <th className="px-6 py-4 text-right">Avg. NAV</th>
                <th className="px-6 py-4 text-right">Current NAV</th>
                <th className="px-6 py-4 text-right">Invested Value</th>
                <th className="px-6 py-4 text-right">Current Value</th>
                <th className="px-6 py-4 text-right">P&L (Returns)</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredFunds.map((fund) => {
                const invested = Number(fund.units) * Number(fund.avg_nav);
                const current = Number(fund.units) * Number(fund.current_nav);
                const pnl = current - invested;
                const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
                const isPositive = pnl >= 0;

                const amc = fund.amc_name || "";
                const logo = getAMCLogoUrl(amc);

                return (
                  <tr key={fund.id} className="group hover:bg-white/[0.02] transition-colors">
                    {/* Scheme Name */}
                    <td className="px-6 py-4 align-middle">
                      <div className="flex items-center gap-3">
                        <AMCAvatar amcName={amc} logoUrl={logo} />
                        <div className="min-w-0">
                          <h4 className="text-[13px] font-bold text-white leading-tight truncate max-w-[280px]" title={fund.fund_name}>
                            {fund.fund_name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[8px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.2 rounded-md uppercase tracking-wider">
                              {fund.category || "Equity"}
                            </span>
                            <span className="text-[8px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.2 rounded-md uppercase tracking-wider">
                              {fund.investment_type || "SIP"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Units */}
                    <td className="px-6 py-4 text-right align-middle font-mono text-[13px] text-[--text-secondary]">
                      {Number(fund.units).toFixed(3)}
                    </td>

                    {/* Avg. NAV */}
                    <td className="px-6 py-4 text-right align-middle font-mono text-[13px] text-[--text-secondary]">
                      ₹{Number(fund.avg_nav).toFixed(2)}
                    </td>

                    {/* Current NAV */}
                    <td className="px-6 py-4 text-right align-middle font-mono text-[13px] text-[--text-secondary]">
                      ₹{Number(fund.current_nav).toFixed(2)}
                    </td>

                    {/* Invested */}
                    <td className="px-6 py-4 text-right align-middle font-mono text-[13px] text-[--text-secondary]">
                      ₹{formatMoney(invested)}
                    </td>

                    {/* Current Value */}
                    <td className="px-6 py-4 text-right align-middle font-mono text-[13px] font-bold text-white">
                      ₹{formatMoney(current)}
                    </td>

                    {/* P&L */}
                    <td className="px-6 py-4 text-right align-middle font-mono text-[13px]">
                      <span className={`font-bold ${isPositive ? 'text-success' : 'text-danger'}`}>
                        {isPositive ? '+' : ''}₹{formatMoney(pnl)}
                      </span>
                      <span className={`text-[10px] block mt-0.5 font-semibold ${isPositive ? 'text-success/80' : 'text-danger/80'}`}>
                        {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 align-middle text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEdit(fund)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
                          title="Edit transaction details"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => onEdit(fund)}
                          className="px-3 py-1.5 rounded-lg bg-[--accent-primary]/10 hover:bg-[--accent-primary] text-[--accent-primary] hover:text-white transition-all text-[10px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          Buy
                        </button>
                        <button
                          onClick={() => onSell(fund)}
                          className="px-3 py-1.5 rounded-lg border border-rose-500/30 hover:bg-rose-500 text-rose-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-wider cursor-pointer"
                        >
                          Redeem
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
