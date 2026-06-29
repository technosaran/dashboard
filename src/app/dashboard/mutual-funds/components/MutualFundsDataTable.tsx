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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {funds.map((fund) => {
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
            className="p-5 rounded-2xl border border-white/5 bg-gradient-to-b from-[#18181e] to-[#121216] hover:border-amber-500/40 hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.15)] hover:scale-[1.01] transition-all duration-300 flex flex-col justify-between min-h-[220px] shadow-lg relative group"
          >
            {/* Top Segment: AMC Avatar, Name, Category tags */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <AMCAvatar amcName={amc} logoUrl={logo} />
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-white leading-tight truncate max-w-[150px]" title={fund.fund_name}>
                    {fund.fund_name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[8px] font-black text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {fund.category || "Equity"}
                    </span>
                    <span className="text-[8px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {fund.investment_type || "SIP"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Edit, Buy, Redeem */}
              <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
            </div>

            {/* Middle Segment: Stats Grid */}
            <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-4 mt-4">
              <div>
                <p className="text-[8px] font-black uppercase tracking-wider text-gray-500">Invested</p>
                <p className="text-xs font-bold text-white mt-1">₹{formatMoney(invested)}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">{Number(fund.units).toFixed(3)} Units</p>
              </div>
              <div>
                <p className="text-[8px] font-black uppercase tracking-wider text-gray-500">Current</p>
                <p className="text-xs font-bold text-white mt-1">₹{formatMoney(current)}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">NAV: ₹{formatMoney(Number(fund.current_nav))}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black uppercase tracking-wider text-gray-500">P&L</p>
                <p className={`text-xs font-bold mt-1 ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isPositive ? '+' : ''}₹{formatMoney(pnl)}
                </p>
                <p className={`text-[9px] font-semibold mt-0.5 ${isPositive ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                  {isPositive ? '+' : ''}{pnlPercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
