
"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import type { Tables } from "@/lib/database.types";
import { recordMFInvestment, refreshNAV, searchMFSchemes, getLiveNAV } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";

type MF = Tables<"mutual_funds"> & { scheme_code?: string | null; fund_symbol?: string | null; pnlPercent?: number };

type MFSchemeSearchResult = {
  schemeCode: number;
  schemeName: string;
};

// Helper function to get official AMC logo (Zerodha Coin Style)
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
  
  return ''; // fallback to initials
}

export default function MutualFundsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { mutualFunds: rawMfs, accounts, mutualFundTrades: trades }, isValidating } = useFinanceData(initialData);
  const mutualFunds = useMemo(() => {
    return rawMfs.map(mf => {
      const currentNav = Number(mf.current_nav || 0);
      const prevNav = Number(mf.previous_nav || 0);
      
      let day_change = Number(mf.day_change || 0);
      let day_change_percent = Number(mf.day_change_percent || 0);

      if (prevNav > 0) {
        day_change = currentNav - prevNav;
        day_change_percent = (day_change / prevNav) * 100;
      }
      return { ...mf, day_change, day_change_percent } as MF;
    });
  }, [rawMfs]);

  const mfs = mutualFunds;
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [activeTab, setActiveTab] = useState<"holdings" | "history">("holdings");
  const refreshingRef = useRef(false);
  const mfsRef = useRef<MF[]>(mfs);
  const isMountedRef = useRef(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MFSchemeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAllCharges, setShowAllCharges] = useState(false);

  const [formData, setFormData] = useState({
    fund_name: "",
    scheme_code: "",
    units: "",
    nav: "",
    investment_type: "SIP",
    category: "Equity",
    amc_name: "HDFC",
    date: new Date().toISOString().split("T")[0],
    account_id: "",
    trade_type: "buy" as "buy" | "sell"
  });

  const stampDuty = useMemo(() => {
    const amount = parseFloat(formData.units || "0") * parseFloat(formData.nav || "0");
    return amount * 0.00005; // 0.005% stamp duty
  }, [formData.units, formData.nav]);

  const totalDeduction = useMemo(() => {
    const amount = parseFloat(formData.units || "0") * parseFloat(formData.nav || "0");
    return formData.trade_type === 'buy' ? amount + stampDuty : amount - stampDuty;
  }, [formData.units, formData.nav, stampDuty, formData.trade_type]);

  const stats = useMemo(() => {
    const totalInvested = mfs.reduce((s, g) => s + (Number(g.units) * Number(g.avg_nav)), 0);
    const totalCurrentValue = mfs.reduce((s, g) => s + (Number(g.units) * Number(g.current_nav)), 0);
    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    const dayPnL = mfs.reduce((s, g) => s + (Number(g.day_change || 0) * Number(g.units || 0)), 0);
    const prevDayValue = totalCurrentValue - dayPnL;
    const dayPnLPercent = prevDayValue > 0 ? (dayPnL / prevDayValue) * 100 : 0;

    return { totalInvested, totalCurrentValue, totalPnL, totalPnLPercent, dayPnL, dayPnLPercent };
  }, [mfs]);

  useEffect(() => {
    mfsRef.current = mfs;
  }, [mfs]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Export MF holdings to CSV
  function exportHoldings() {
    const csvData = mfs.map(mf => {
      const investment = Number(mf.units) * Number(mf.avg_nav);
      const currentVal = Number(mf.units) * Number(mf.current_nav);
      const pnl = currentVal - investment;
      const pnlPercent = investment > 0 ? (pnl / investment) * 100 : 0;
      return {
        'Fund Name': mf.fund_name,
        'AMC': mf.amc_name || '',
        'Category': mf.category || '',
        'Type': mf.investment_type || '',
        'Units': Number(mf.units).toFixed(3),
        'Avg NAV': Number(mf.avg_nav).toFixed(4),
        'Current NAV': Number(mf.current_nav).toFixed(4),
        'Invested': investment.toFixed(2),
        'Current Value': currentVal.toFixed(2),
        'P&L': pnl.toFixed(2),
        'P&L %': pnlPercent.toFixed(2)
      };
    });
    
    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => `"${row[h as keyof typeof row]}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mutual_funds_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Mutual funds exported successfully');
  }


  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results = await searchMFSchemes(val);
    setSearchResults(results);
    setIsSearching(false);
  };

  const selectScheme = async (scheme: MFSchemeSearchResult) => {
    setFormData({ ...formData, fund_name: scheme.schemeName, scheme_code: scheme.schemeCode.toString() });
    setSearchResults([]);
    setSearchQuery(scheme.schemeName);
    
    // Fetch live NAV
    const toastId = toast.loading("Fetching latest NAV for " + scheme.schemeName);
    const live = await getLiveNAV(scheme.schemeCode.toString());
    if (live) {
        setFormData(prev => ({ 
            ...prev, 
            nav: live.nav.toString(),
            amc_name: live.amc || prev.amc_name
        }));
        toast.success("NAV Updated", { id: toastId });
    } else {
        toast.error("Failed to fetch live NAV", { id: toastId });
    }
  };

  const startSell = (mf: MF) => {
    setFormData({
        fund_name: mf.fund_name,
        scheme_code: mf.fund_symbol || mf.scheme_code || "",
        units: mf.units.toString(),
        nav: mf.current_nav.toString(),
        investment_type: mf.investment_type || "LUMPSUM",
        category: mf.category || "Equity",
        amc_name: mf.amc_name || "",
        date: new Date().toISOString().split("T")[0],
        account_id: "",
        trade_type: "sell"
    });
    setSearchQuery(mf.fund_name);
    setShowAddModal(true);
  };

  async function handleAddMF(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.account_id) {
        toast.error("Please select a channeling account");
        return;
    }
    await withLock(async () => {
      const res = await recordMFInvestment({
        ...formData,
        units: parseFloat(formData.units),
        nav: parseFloat(formData.nav),
        stamp_duty: stampDuty,
        trade_type: formData.trade_type
      });
      if (!res?.error) {
        toast.success(formData.trade_type === 'buy' ? "Wealth deployed into mutual fund" : "Mutual fund units liquidated successfully");
        setShowAddModal(false);
        setFormData({ 
          fund_name: "", scheme_code: "", units: "", nav: "", 
          investment_type: "SIP", category: "Equity", amc_name: "HDFC",
          date: new Date().toISOString().split("T")[0], account_id: "",
          trade_type: "buy"
        });
        setSearchQuery("");
      } else {
        toast.error(res.error);
      }
    });
  }

  const handleRefreshAll = useCallback(async () => {
    if (!isMountedRef.current || refreshingRef.current) return;
    refreshingRef.current = true;
    const toastId = toast.loading("Syncing with Market NAVs...");
    try {
        await refreshNAV(mfsRef.current.map((mf) => ({ id: mf.id, scheme_code: mf.fund_symbol || mf.scheme_code || "" })));
        toast.success("Portfolio revalued!", { id: toastId });
    } catch {
        toast.error("Sync failed", { id: toastId });
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void handleRefreshAll();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void handleRefreshAll();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [handleRefreshAll]);


  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      
      {/* Portfolio Overview */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Mutual Funds</h1>
            <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mt-1">Live NAV Tracking Console</p>
          </div>
          <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
        </div>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto">
            {/* Auto refreshing enabled */}
            <button 
              onClick={exportHoldings} 
              className="btn-secondary !h-11 !px-6 flex items-center justify-center gap-2 hidden md:flex"
              title="Export Holdings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            <button 
              onClick={() => { setFormData(prev => ({ ...prev, trade_type: 'buy' })); setSearchQuery(""); setShowAddModal(true); }} 
              className="btn-primary !h-12 md:!h-11 !px-8 w-full md:w-auto text-[13px] md:text-[11px] font-black uppercase tracking-widest shadow-[0_4px_20px_rgba(var(--accent-primary-rgb),0.3)] order-first md:order-last"
            >
                Record Investment
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="hidden md:grid grid-cols-2 md:grid-cols-5 gap-4 px-4">
        <div className="glass-card-static p-6 flex flex-col gap-2">
            <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Invested Capital</span>
            <span className="text-xl md:text-2xl font-black tabular-nums">₹{stats.totalInvested.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
            <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Current Value</span>
            <span className="text-xl md:text-2xl font-black tabular-nums">₹{stats.totalCurrentValue.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
            <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Total P&L</span>
            <div className="flex flex-col">
              <span className={`text-xl md:text-2xl font-black tabular-nums ${stats.totalPnL >= 0 ? "text-[--success]" : "text-[--danger]"}`}>
                  {stats.totalPnL >= 0 ? "+" : "-"}₹{Math.abs(stats.totalPnL).toLocaleString()}
              </span>
              <span className={`text-[10px] font-black ${stats.totalPnL >= 0 ? "text-[--success]" : "text-[--danger]"} opacity-60`}>
                  ({stats.totalPnL >= 0 ? "+" : ""}{stats.totalPnLPercent.toFixed(2)}%)
              </span>
            </div>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
            <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Avg. Return</span>
            <span className={`text-xl md:text-2xl font-black tabular-nums ${stats.totalPnL >= 0 ? "text-[--success]" : "text-[--danger]"}`}>
                {stats.totalPnL >= 0 ? "+" : ""}{stats.totalPnLPercent.toFixed(2)}%
            </span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
            <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Day's P&L</span>
            <div className="flex flex-col">
              <span className={`text-xl md:text-2xl font-black tabular-nums ${stats.dayPnL >= 0 ? "text-[--success]" : "text-[--danger]"}`}>
                  {stats.dayPnL >= 0 ? "+" : "-"}₹{Math.abs(stats.dayPnL).toLocaleString()}
              </span>
              <span className={`text-[10px] font-black ${stats.dayPnL >= 0 ? "text-[--success]" : "text-[--danger]"} opacity-60`}>
                  ({stats.dayPnL >= 0 ? "+" : ""}{stats.dayPnLPercent.toFixed(2)}%)
              </span>
            </div>
        </div>
      </div>

      <div className="mx-4 flex items-center gap-1 bg-white/5 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("holdings")}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "holdings" ? "bg-[--accent-primary] text-white shadow-lg shadow-[--accent-primary]/20" : "text-[--text-muted] hover:text-[--text-primary]"}`}
        >
          Holdings ({mfs.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "history" ? "bg-[--success] text-white shadow-lg shadow-[--success]/20" : "text-[--text-muted] hover:text-[--text-primary]"}`}
        >
          History ({trades.length})
        </button>
      </div>

      {activeTab === "holdings" ? (
        <div className="mx-4 border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest">Growth Scheme</th>
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Volume</th>
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Avg NAV</th>
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Live NAV</th>
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Day Change</th>
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {mfs.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-24 text-center text-[#666] italic text-sm">Synchronize with Zerodha Coin or manual entry to view portfolio.</td></tr>
              ) : mfs.map((mf) => {
                  const investment = Number(mf.units) * Number(mf.avg_nav);
                  const currentVal = Number(mf.units) * Number(mf.current_nav);
                  const pnl = currentVal - investment;
                  const pnlPercent = investment > 0 ? (pnl / investment) * 100 : 0;
                  return (
                      <tr key={mf.id} className="hover:bg-white/[0.01] group transition-colors">
                          <td className="px-6 py-5">
                              <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/20 p-0.5 shadow-md">
                                    {getAMCLogoUrl(mf.amc_name || '') ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={getAMCLogoUrl(mf.amc_name || '')} alt={mf.amc_name || 'AMC'} className="w-full h-full object-contain rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                                    ) : null}
                                    <span className={`text-[15px] font-black text-slate-800 ${getAMCLogoUrl(mf.amc_name || '') ? 'hidden' : ''}`}>
                                      {mf.amc_name ? mf.amc_name.substring(0, 1).toUpperCase() : 'M'}
                                    </span>
                                  </div>
                                  <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                          <span className="font-bold text-[14px] text-[#eee] group-hover:text-[--accent-primary-light] transition-colors">{mf.fund_name}</span>
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button 
                                                  onClick={(e) => {
                                                      e.stopPropagation();
                                                      toast(`Total Charges: ₹${(Number(mf.units) * Number(mf.avg_nav) * 0.00005).toFixed(4)} (Stamp Duty)`, {
                                                          icon: '👁️',
                                                          style: { background: '#1a1a1a', color: '#eee', border: '1px solid #333', fontSize: '11px', fontWeight: 'bold' }
                                                      });
                                                  }}
                                                  className="p-1 hover:bg-white/5 rounded text-[10px]"
                                                  title="View charges"
                                              >
                                                  👁️
                                              </button>
                                              <button 
                                                  onClick={(e) => { e.stopPropagation(); startSell(mf); }}
                                                  className="px-2 py-0.5 bg-[--danger]/10 hover:bg-[--danger] text-[--danger] hover:text-white text-[9px] font-black uppercase rounded transition-all"
                                              >
                                                  Redeem
                                              </button>
                                          </div>
                                      </div>
                                      <span className="text-[10px] text-[#666] font-bold uppercase tracking-wide mt-0.5">{mf.category} • {mf.investment_type}</span>
                                  </div>
                              </div>
                          </td>
                          <td className="px-6 py-5 text-right font-bold tabular-nums text-[#eee] text-[14px]">{Number(mf.units).toFixed(3)}</td>
                          <td className="px-6 py-5 text-right font-medium tabular-nums text-[#666] text-[13px]">₹{Number(mf.avg_nav).toFixed(3)}</td>
                          <td className="px-6 py-5 text-right font-bold tabular-nums text-[#eee] text-[14px]">₹{Number(mf.current_nav).toFixed(3)}</td>
                           <td className="px-6 py-5 text-right tabular-nums">
                               <div className="flex flex-col items-end">
                                   <span className={`text-[13px] font-bold ${mf.day_change && mf.day_change >= 0 ? "text-[--success]" : "text-[--danger]"}`}>
                                       {mf.day_change && mf.day_change > 0 ? "+" : ""}{mf.day_change ? Number(mf.day_change).toFixed(4) : "—"}
                                   </span>
                                   <span className={`text-[10px] font-bold ${mf.day_change_percent && mf.day_change_percent >= 0 ? "text-[--success]" : "text-[--danger]"} opacity-60`}>
                                       {mf.day_change_percent && mf.day_change_percent > 0 ? "+" : ""}{mf.day_change_percent ? Number(mf.day_change_percent).toFixed(2) : "0.00"}%
                                   </span>
                               </div>
                           </td>
                          <td className="px-6 py-5 text-right whitespace-nowrap">
                              <div className={`flex flex-col items-end ${pnl >= 0 ? "text-[--success]" : "text-[--danger]"}`}>
                                  <span className="text-[14px] font-bold tabular-nums">{pnl >= 0 ? "+" : "-"}₹{Math.abs(pnl).toLocaleString()}</span>
                                  <span className="text-[11px] font-bold tabular-nums opacity-60">{pnl >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%</span>
                              </div>
                          </td>
                      </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mx-4 border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest">Scheme</th>
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest">Action</th>
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Units</th>
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">NAV</th>
                <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {trades.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-[#666] italic text-sm">No transaction history recorded yet.</td></tr>
              ) : trades.map((trade) => (
                <tr key={trade.id} className="hover:bg-white/[0.01] transition-colors">
                  <td className="px-6 py-4 text-[12px] font-bold text-[--text-muted] tabular-nums">{trade.date}</td>
                  <td className="px-6 py-4"><span className="text-[13px] font-bold text-[#eee]">{trade.fund_name}</span></td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${trade.trade_type === 'BUY' ? 'bg-[--success]/10 text-[--success]' : 'bg-[--danger]/10 text-[--danger]'}`}>
                      {trade.trade_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium tabular-nums text-[#eee] text-[13px]">{Number(trade.units).toFixed(3)}</td>
                  <td className="px-6 py-4 text-right font-medium tabular-nums text-[#666] text-[13px]">₹{Number(trade.nav).toFixed(3)}</td>
                  <td className="px-6 py-4 text-right font-black tabular-nums text-[#eee] text-[14px]">₹{Number(trade.amount).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Investment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in px-4">
          <div className="glass-card-static w-full max-w-3xl p-8 md:p-12 rounded-3xl">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-3xl font-black tracking-tight">{formData.trade_type === 'buy' ? 'Investment Log' : 'Asset Redemption'}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-[--text-muted] hover:text-[--text-primary] transition-colors p-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddMF} className="space-y-6">
              
              {/* Scheme Search */}
              <div className="relative space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Search Growth Scheme</label>
                <div className="relative">
                    <input 
                        required 
                        className="input-premium h-14 pl-12" 
                        placeholder="Search for Axis, HDFC, SBI Mutual Funds..." 
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        disabled={formData.trade_type === 'sell'}
                    />
                    <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#666]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
                    {isSearching && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[--accent-primary] border-t-transparent rounded-full animate-spin" />}
                </div>

                {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-[210] mt-2 bg-[#131833] border border-[#252525] rounded-2xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
                        {searchResults.map((s) => (
                            <button key={s.schemeCode} type="button" onClick={() => selectScheme(s)} className="w-full p-4 text-left hover:bg-[#1a2045] border-b border-[#252525] transition-colors flex flex-col gap-1">
                                <span className="text-sm font-bold text-[#eee]">{s.schemeName}</span>
                                <span className="text-[10px] font-bold text-[#666] uppercase tracking-wide">Scheme Code: {s.schemeCode}</span>
                            </button>
                        ))}
                    </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Allocated Units</label>
                  <input required type="number" step="0.001" className="input-premium h-12" placeholder="0.000" value={formData.units} onChange={e => setFormData({...formData, units: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">{formData.trade_type === 'buy' ? 'Avg. Buy Price (NAV)' : 'Redemption NAV'}</label>
                  <input required type="number" step="0.0001" className="input-premium h-12" placeholder="0.0000" value={formData.nav} onChange={e => setFormData({...formData, nav: e.target.value})} />
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Investment Model</label>
                  <select className="input-premium h-12" value={formData.investment_type} onChange={e => setFormData({...formData, investment_type: e.target.value})}>
                    <option value="SIP" style={{background: '#131833'}}>SIP Engine</option>
                    <option value="LUMPSUM" style={{background: '#131833'}}>One-Time Capital</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">{formData.trade_type === 'buy' ? 'Capital Source' : 'Deposit To'}</label>
                    <select required className="input-premium h-12" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                        <option value="">{formData.trade_type === 'buy' ? 'Fund Account' : 'Dest. Account'}</option>
                        {accounts.map(acc => <option key={acc.id} value={acc.id} style={{background: '#131833'}}>{acc.name} (₹{acc.balance.toLocaleString()})</option>)}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Trade Date</label>
                    <input type="date" className="input-premium h-12" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Asset Sector</label>
                    <select className="input-premium h-12" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        {["Equity", "Debt", "Hybrid", "Index", "Liquid", "ELSS"].map(c => <option key={c} value={c} style={{background: '#131833'}}>{c}</option>)}
                    </select>
                </div>
              </div>

              {/* Charge Summary Box (With Toggle) */}
              <div className="bg-[#131833] border border-[#252525] rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-[#555] uppercase tracking-widest">Transaction Levies</span>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[14px] font-black text-rose-400">₹{stampDuty.toFixed(4)}</span>
                            <button 
                                type="button" 
                                onClick={() => setShowAllCharges(!showAllCharges)}
                                className="text-[9px] font-black text-[--accent-primary-light] uppercase tracking-widest hover:underline"
                            >
                                {showAllCharges ? "Hide Details" : "See More"}
                            </button>
                        </div>
                    </div>
                    <span className="text-[9px] text-[#387ed1] border border-[#387ed1]/20 px-2 py-0.5 rounded font-black uppercase">SEBI Regulatory</span>
                </div>

                {showAllCharges && (
                    <div className="space-y-2 pt-2 border-t border-white/5 animate-fade-in">
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="text-[#666] font-bold uppercase tracking-wide">Investment Value</span>
                            <span className="text-[#eee] font-bold">₹{(parseFloat(formData.units || "0") * parseFloat(formData.nav || "0")).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="text-[#666] font-bold uppercase tracking-wide">Stamp Duty (0.005%)</span>
                            <span className="text-rose-400 font-bold">{formData.trade_type === 'buy' ? '+' : '-'}₹{stampDuty.toFixed(4)}</span>
                        </div>
                    </div>
                )}

                <div className="pt-3 border-t border-[#252525] flex justify-between items-center">
                    <span className="text-[11px] font-black text-[#666] uppercase tracking-widest">{formData.trade_type === 'buy' ? 'Net Payable' : 'Net Receivable'}</span>
                    <span className="text-base font-black text-[--accent-primary-light]">₹{totalDeduction.toLocaleString()}</span>
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full shadow-2xl mt-4">
                 {submitting ? (formData.trade_type === 'buy' ? "Deploying Capital..." : "Liquidating...") : (formData.trade_type === 'buy' ? "Authorize Investment" : "Authorize Redemption")}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
