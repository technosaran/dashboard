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

      {/* Cards Grid (Zerodha Coin Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFunds.map((fund) => {
          const invested = Number(fund.units) * Number(fund.avg_nav);
          const current = Number(fund.units) * Number(fund.current_nav);
          const pnl = current - invested;
          const pnlPercent = invested > 0 ? (pnl / invested) * 100 : 0;
          const isPositive = pnl >= 0;

          const amc = fund.amc_name || "";
          const logo = getAMCLogoUrl(amc);

          return (
            <div 
              key={fund.id} 
              className="bg-[#151515] border border-white/5 rounded-lg p-5 flex flex-col justify-between hover:border-white/10 transition-all duration-300 shadow-md group relative"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <AMCAvatar amcName={amc} logoUrl={logo} />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate tracking-wide" title={fund.fund_name}>
                      {fund.fund_name}
                    </h4>
                    <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{fund.amc_name || "Mutual Fund"}</p>
                  </div>
                </div>

                <button 
                  onClick={() => onEdit(fund)}
                  className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center text-[10px] transition-colors"
                  title="Edit details"
                >
                  ✏️
                </button>
              </div>

              {/* Badges */}
              <div className="flex gap-2 mt-4">
                <span className="text-[9px] font-bold text-gray-400 px-2 py-0.5 bg-white/5 border border-white/10 rounded uppercase tracking-wider">
                  {fund.category || "Equity"}
                </span>
                <span className="text-[9px] font-bold text-gray-400 px-2 py-0.5 bg-white/5 border border-white/10 rounded uppercase tracking-wider">
                  {fund.investment_type || "SIP"}
                </span>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/5 my-4 w-full" />

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                <div>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Invested</span>
                  <span className="text-xs font-semibold text-gray-300">₹{formatMoney(invested)}</span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">{Number(fund.units).toFixed(3)} units</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Current Value</span>
                  <span className="text-sm font-bold text-white">₹{formatMoney(current)}</span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">NAV: ₹{Number(fund.current_nav).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Avg. NAV</span>
                  <span className="text-xs text-gray-300">₹{Number(fund.avg_nav).toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Total Returns</span>
                  <span className={`text-xs font-bold ${isPositive ? 'text-[#4caf50]' : 'text-[#f44336]'}`}>
                    {isPositive ? '+' : ''}₹{formatMoney(pnl)}
                    <span className="text-[10px] font-semibold ml-1">({isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
                  </span>
                </div>
              </div>

              {/* Footer Actions (Coin style B/S buttons) */}
              <div className="flex gap-3 mt-5 pt-3 border-t border-white/5">
                <button 
                  onClick={() => onEdit(fund)}
                  className="flex-1 py-1.5 rounded bg-[#2185d0]/10 hover:bg-[#2185d0] text-[#2185d0] hover:text-white transition-all text-[11px] font-bold uppercase tracking-wider text-center"
                >
                  Invest More
                </button>
                <button 
                  onClick={() => onSell(fund)}
                  className="flex-1 py-1.5 rounded border border-rose-500/30 hover:bg-rose-500/10 text-rose-500 transition-all text-[11px] font-bold uppercase tracking-wider text-center"
                >
                  Redeem
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
