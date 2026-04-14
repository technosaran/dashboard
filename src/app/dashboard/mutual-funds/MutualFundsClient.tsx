
"use client";

import { useState, useMemo, useCallback, useEffect, startTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { recordMFInvestment, refreshNAV, searchMFSchemes, getLiveNAV } from "./actions";
import { useRealTimeSync } from "@/hooks/use-realtime-sync";

type MF = Tables<"mutual_funds"> & { scheme_code?: string; fund_symbol?: string | null };
type Account = Tables<"accounts">;
type MFSchemeSearchResult = {
  schemeCode: number;
  schemeName: string;
};

export default function MutualFundsClient({ initialIncomes, initialAccounts }: { initialIncomes: MF[], initialAccounts: Account[] }) {
  const [mfs, setMfs] = useState<MF[]>(initialIncomes);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
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

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const [mfRes, accRes] = await Promise.all([
        supabase.from("mutual_funds").select("*").eq("user_id", user.id).order("fund_name"),
        supabase.from("accounts").select("*").eq("user_id", user.id).order("name")
    ]);

    if (mfRes.data) setMfs(mfRes.data);
    if (accRes.data) setAccounts(accRes.data);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase.channel("mf-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "mutual_funds" }, () => startTransition(fetchData))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, supabase]);

  useRealTimeSync(fetchData);

  const stats = useMemo(() => {
    const totalInvested = mfs.reduce((s, g) => s + (Number(g.units) * Number(g.avg_nav)), 0);
    const totalCurrentValue = mfs.reduce((s, g) => s + (Number(g.units) * Number(g.current_nav)), 0);
    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    return { totalInvested, totalCurrentValue, totalPnL, totalPnLPercent };
  }, [mfs]);

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
    if (!formData.account_id) {
        toast.error("Please select a channeling account");
        return;
    }
    e.preventDefault();
    setSubmitting(true);
    const res = await recordMFInvestment({
      ...formData,
      units: parseFloat(formData.units),
      nav: parseFloat(formData.nav),
      stamp_duty: stampDuty,
      trade_type: formData.trade_type
    });
    if (!res?.error) {
      toast.success(formData.trade_type === 'buy' ? "Investment deployed successfully" : "Redemption processed successfully");
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
    setSubmitting(false);
  }

  useEffect(() => {
    handleRefreshAll();
    const timer = setInterval(() => {
      handleRefreshAll();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  async function handleRefreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    const toastId = toast.loading("Syncing with Market NAVs...");
    try {
        await refreshNAV(mfs.map((mf) => ({ id: mf.id, scheme_code: mf.fund_symbol || mf.scheme_code || "" })));
        toast.success("Portfolio revalued!", { id: toastId });
    } catch {
        toast.error("Sync failed", { id: toastId });
    }
    setRefreshing(false);
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in text-[--text-primary] py-6" style={{ maxWidth: "1280px", margin: "0 auto", width: "100%", paddingBottom: "100px" }}>
      
      {/* Portfolio Overview */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Mutual Funds</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mt-1">Live NAV Tracking Console</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Auto refreshing enabled */}
            <button onClick={() => { setFormData(prev => ({ ...prev, trade_type: 'buy' })); setSearchQuery(""); setShowAddModal(true); }} className="btn-primary !h-11 !px-8">
                Record Investment
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
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
            <span className={`text-xl md:text-2xl font-black tabular-nums ${stats.totalPnL >= 0 ? "text-[--success]" : "text-[--danger]"}`}>
                {stats.totalPnL >= 0 ? "+" : ""}₹{Math.abs(stats.totalPnL).toLocaleString()}
            </span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
            <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Yield</span>
            <span className={`text-xl md:text-2xl font-black tabular-nums ${stats.totalPnL >= 0 ? "text-[--success]" : "text-[--danger]"}`}>
                {stats.totalPnL >= 0 ? "+" : ""}{stats.totalPnLPercent.toFixed(2)}%
            </span>
        </div>
      </div>

      {/* Modern MF Table */}
      <div className="mx-4 border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest">Growth Scheme</th>
              <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Volume</th>
              <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Avg NAV</th>
              <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Live NAV</th>
              <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {mfs.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-24 text-center text-[#666] italic text-sm">Synchronize with Zerodha Coin or manual entry to view portfolio.</td></tr>
            ) : mfs.map((mf) => {
                const investment = Number(mf.units) * Number(mf.avg_nav);
                const currentVal = Number(mf.units) * Number(mf.current_nav);
                const pnl = currentVal - investment;
                const pnlPercent = investment > 0 ? (pnl / investment) * 100 : 0;
                return (
                    <tr key={mf.id} className="hover:bg-white/[0.01] group transition-colors">
                        <td className="px-6 py-5">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center font-black text-[9px] text-[--accent-primary-light] shadow-inner">
                                    {mf.amc_name?.substring(0, 3)}
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
                                            >
                                                👁️
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); startSell(mf); }}
                                                className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white text-[9px] font-black uppercase rounded transition-all"
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
                        <td className="px-6 py-5 text-right whitespace-nowrap">
                            <div className={`flex flex-col items-end ${pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
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

      {/* Record Investment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in px-4">
          <div className="glass-card-static w-full max-w-3xl p-8 md:p-12 rounded-3xl animate-scale-in">
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

              <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-6">
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
