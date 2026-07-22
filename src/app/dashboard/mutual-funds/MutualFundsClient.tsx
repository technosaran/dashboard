"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import type { Tables } from "@/lib/database.types";
import { recordMFInvestment, updateMFHolding, searchMFSchemes, fetchLiveMFNAV } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";
import { getColorByLabel } from "@/lib/chart-colours";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

import MutualFundsDataTable, { AMCAvatar } from "./components/MutualFundsDataTable";
import MFHistoryTable from "./components/MFHistoryTable";
import { calculateMutualFundCharges } from "@/lib/zerodha-charges";

type MF = Tables<"mutual_funds"> & { scheme_code?: string | null; fund_symbol?: string | null; pnlPercent?: number; day_change?: number; day_change_percent?: number };

export default function MutualFundsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { mutualFunds: rawMfs, accounts, profile, mutualFundTrades }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Coin uses Dashboard, Mutual Funds (Holdings, Orders)
  const [activeTab, setActiveTab] = useState<"dashboard" | "holdings" | "history">("dashboard");

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [charges, setCharges] = useState("0");
  const [isCustomCharges, setIsCustomCharges] = useState(false);

  const [formData, setFormData] = useState({
    fund_name: "",
    scheme_code: "",
    units: "",
    nav: "",
    current_nav: "",
    investment_type: "SIP",
    category: "Equity",
    amc_name: "",
    date: new Date().toISOString().split("T")[0],
    account_id: "",
    trade_type: "buy" as "buy" | "sell"
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ schemeCode: string, schemeName: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  useEffect(() => {
    if (searchQuery.length > 2) {
      setIsSearching(true);
      setShowSearchDropdown(true);
      const timeoutId = setTimeout(async () => {
        const results = await searchMFSchemes(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (accounts.length > 0 && showAddModal && !formData.account_id) {
      const defaultAccId = profile?.default_accounts?.mutual_funds;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      const chosenAccount = defaultAccExists ? defaultAccId : accounts[0].id;
      setTimeout(() => {
        setFormData(prev => ({ ...prev, account_id: chosenAccount }));
      }, 0);
    }
  }, [accounts, profile, showAddModal, formData.account_id]);

  const mutualFunds = useMemo(() => {
    return rawMfs.filter(mf => Number(mf.units) > 0).map(mf => {
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

  const stats = useMemo(() => {
    const totalInvested = mutualFunds.reduce((s, g) => s + (Number(g.units) * Number(g.avg_nav)), 0);
    const totalCurrentValue = mutualFunds.reduce((s, g) => s + (Number(g.units) * Number(g.current_nav)), 0);
    const totalPnL = totalCurrentValue - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    const dayPnL = mutualFunds.reduce((s, g) => s + (Number(g.day_change || 0) * Number(g.units || 0)), 0);
    const prevDayValue = totalCurrentValue - dayPnL;
    const dayPnLPercent = prevDayValue > 0 ? (dayPnL / prevDayValue) * 100 : 0;

    return { totalInvested, totalCurrentValue, totalPnL, totalPnLPercent, dayPnL, dayPnLPercent };
  }, [mutualFunds]);

  const pieChartData = useMemo(() => {
    const catMap: Record<string, number> = {};
    mutualFunds.forEach(mf => {
      const cat = mf.category || "Others";
      catMap[cat] = (catMap[cat] || 0) + (Number(mf.units) * Number(mf.current_nav));
    });
    return Object.entries(catMap).map(([name, value]) => ({
      name,
      value,
      fill: getColorByLabel(name)
    })).sort((a, b) => b.value - a.value);
  }, [mutualFunds]);

  const startSell = (mf: MF) => {
    setFormData({
        fund_name: mf.fund_name,
        scheme_code: mf.fund_symbol || mf.scheme_code || "",
        units: "",
        nav: mf.current_nav.toString(),
        current_nav: mf.current_nav.toString(),
        investment_type: mf.investment_type || "LUMPSUM",
        category: mf.category || "Equity",
        amc_name: mf.amc_name || "",
        date: new Date().toISOString().split("T")[0],
        account_id: "",
        trade_type: "sell"
    });
    setCharges("0");
    setShowAddModal(true);
  };

  const startBuy = (mf: MF) => {
    setFormData({
        fund_name: mf.fund_name,
        scheme_code: mf.fund_symbol || mf.scheme_code || "",
        units: "",
        nav: mf.current_nav.toString(),
        current_nav: mf.current_nav.toString(),
        investment_type: mf.investment_type || "SIP",
        category: mf.category || "Equity",
        amc_name: mf.amc_name || "",
        date: new Date().toISOString().split("T")[0],
        account_id: "",
        trade_type: "buy"
    });
    setCharges("0");
    setEditingId(null);
    setShowAddModal(true);
  };

  const startEdit = (mf: MF) => {
    setEditingId(mf.id);
    setFormData({
      fund_name: mf.fund_name,
      scheme_code: mf.fund_symbol || mf.scheme_code || "",
      units: mf.units.toString(),
      nav: mf.avg_nav.toString(),
      current_nav: mf.current_nav.toString(),
      investment_type: mf.investment_type || "SIP",
      category: mf.category || "Equity",
      amc_name: mf.amc_name || "",
      date: new Date().toISOString().split("T")[0],
      account_id: "",
      trade_type: "buy"
    });
    setCharges("0");
    setShowAddModal(true);
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshNAV = async () => {
    setIsRefreshing(true);
    let updated = 0;
    try {
      for (const mf of rawMfs) {
        let code: string | undefined = mf.scheme_code || undefined;
        if (!code) {
          const searchResults = await searchMFSchemes(mf.fund_name);
          if (searchResults && searchResults.length > 0 && searchResults[0].schemeCode) {
            code = searchResults[0].schemeCode;
            await updateMFHolding(mf.id, { scheme_code: code, fund_symbol: code });
          }
        }
        if (!code) continue;
        const liveData = await fetchLiveMFNAV(code);
        if (liveData && (liveData.nav !== mf.current_nav || liveData.previousNav !== mf.previous_nav)) {
          const updatePayload: { current_nav: number; previous_nav?: number } = { current_nav: liveData.nav };
          if (liveData.previousNav) updatePayload.previous_nav = liveData.previousNav;
          await updateMFHolding(mf.id, updatePayload);
          updated++;
        }
      }
      if (updated > 0) {
        mutate();
        toast.success(`Refreshed live NAVs for ${updated} funds!`);
      } else {
        toast.success("NAVs are already up to date.");
      }
    } catch {
      toast.error("Failed to refresh some NAVs");
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshedRef = useRef(false);
  useEffect(() => {
    if (rawMfs.length > 0 && !refreshedRef.current) {
      refreshedRef.current = true;
      const today = new Date().toISOString().split("T")[0];
      if (localStorage.getItem("last_mf_refresh") !== today) {
        localStorage.setItem("last_mf_refresh", today);
        handleRefreshNAV();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMfs]);

  async function handleAddMF(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      try {
        if (editingId) {
          const res = await updateMFHolding(editingId, {
            fund_name: formData.fund_name,
            amc_name: formData.amc_name,
            scheme_code: formData.scheme_code,
            fund_symbol: formData.scheme_code,
            units: parseFloat(formData.units),
            avg_nav: parseFloat(formData.nav),
            current_nav: parseFloat(formData.current_nav || formData.nav),
            category: formData.category,
            investment_type: formData.investment_type
          });
          if (!res?.error) {
            toast.success("Mutual fund holding updated successfully");
            setShowAddModal(false);
            setEditingId(null);
            mutate();
          } else toast.error(res.error);
        } else {
          if (!formData.account_id) {
            toast.error("Please select a channeling account");
            return;
          }
          
          const chargeAmt = parseFloat(charges) || 0;
          
          const res = await recordMFInvestment({
            fund_name: formData.fund_name,
            amc_name: formData.amc_name,
            scheme_code: formData.scheme_code,
            units: parseFloat(formData.units),
            nav: parseFloat(formData.nav),
            category: formData.category,
            investment_type: formData.investment_type,
            account_id: formData.account_id,
            date: formData.date,
            stamp_duty: chargeAmt,
            trade_type: formData.trade_type
          });
          
          if (!res?.error) {
            toast.success(formData.trade_type === 'buy' ? "Investment recorded successfully" : "Redemption recorded successfully");
            setShowAddModal(false);
            mutate();
          } else toast.error(res.error);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to record MF investment");
      }
    });
  }

  const formatMoney = (val: number) => val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col animate-in fade-in duration-700 w-full bg-[#131722] min-h-screen text-[#E0E0E0] relative font-sans">
      {/* Background Ambient Coin Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[550px] h-[550px] bg-[#FF5722]/10 rounded-full blur-[160px]" />
        <div className="absolute top-1/2 -left-32 w-[550px] h-[550px] bg-sky-500/10 rounded-full blur-[160px]" />
      </div>

      {/* Zerodha Coin Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-8 py-3.5 border-b border-[#2B313A] bg-[#181A20] relative z-10 shadow-xl gap-4">
        <div className="flex items-center gap-4">
          {/* Zerodha Coin Emblem */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF5722]/20 to-[#FF7043]/10 border border-[#FF5722]/40 flex items-center justify-center text-[#FF5722] shadow-[0_0_15px_rgba(255,87,34,0.3)]">
            <span className="text-lg font-black tracking-tighter text-[#FF5722]">©</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white tracking-wider uppercase">Zerodha Coin Mutual Funds</h1>
              <span className="text-[0.5625rem] bg-[#FF5722]/20 text-[#FF5722] border border-[#FF5722]/30 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">COIN PRO</span>
            </div>
            <p className="text-[0.6875rem] text-[#848E9C] font-semibold flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#0ECB81] animate-pulse" />
              0% Commission Direct Mutual Funds • Live NAV Tracker
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex gap-1.5 rounded-xl bg-[#131722] border border-[#2B313A] p-1 shadow-inner">
            <button 
              onClick={() => setActiveTab("dashboard")} 
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                activeTab === "dashboard" 
                  ? "bg-[#FF5722] text-white shadow-[0_0_15px_rgba(255,87,34,0.4)]" 
                  : "text-[#848E9C] hover:text-white hover:bg-white/5"
              }`}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab("holdings")} 
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                activeTab === "holdings" 
                  ? "bg-[#FF5722] text-white shadow-[0_0_15px_rgba(255,87,34,0.4)]" 
                  : "text-[#848E9C] hover:text-white hover:bg-white/5"
              }`}
            >
              Holdings ({mutualFunds.length})
            </button>
            <button 
              onClick={() => setActiveTab("history")} 
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                activeTab === "history" 
                  ? "bg-[#FF5722] text-white shadow-[0_0_15px_rgba(255,87,34,0.4)]" 
                  : "text-[#848E9C] hover:text-white hover:bg-white/5"
              }`}
            >
              SIP &amp; Orders
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefreshNAV} 
              disabled={isRefreshing || rawMfs.length === 0}
              className="bg-[#2B313A]/50 hover:bg-[#2B313A] border border-[#2B313A] text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isRefreshing ? (
                <svg className="w-3.5 h-3.5 animate-spin text-[#FF5722]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-[#FF5722]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              )}
              Refresh NAV
            </button>
            <button 
              onClick={() => { 
                setFormData({
                  fund_name: "", scheme_code: "", units: "", nav: "", current_nav: "",
                  investment_type: "SIP", category: "Equity", amc_name: "HDFC",
                  date: new Date().toISOString().split("T")[0], account_id: "", trade_type: "buy"
                });
                setEditingId(null);
                setShowAddModal(true); 
              }} 
              className="bg-[#FF5722] hover:bg-[#e04a1b] text-white font-extrabold px-4 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(255,87,34,0.3)] cursor-pointer"
            >
              + Start SIP / Invest
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 w-full relative z-10">
        {activeTab === "dashboard" && (
          <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-stretch mt-4">
            {/* Left: Large Allocation Donut Card */}
            <div className="flex-1 flex flex-col items-center justify-center glass-card-static backdrop-blur-2xl bg-white/[0.03] border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="absolute -top-20 -left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-[80px] pointer-events-none" />
              <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-6 relative z-10">Asset Allocation</h3>
              {mounted && pieChartData.length > 0 ? (
                <div className="w-[300px] h-[300px] relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={85} outerRadius={118} paddingAngle={3} dataKey="value" stroke="none">
                        {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: "rgba(15, 20, 32, 0.90)", 
                          backdropFilter: "blur(16px)", 
                          WebkitBackdropFilter: "blur(16px)",
                          border: "1px solid rgba(255, 255, 255, 0.15)", 
                          borderRadius: "16px",
                          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                          padding: "10px 14px"
                        }}
                        itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}
                        formatter={(value) => [`₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, "Valuation"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-gray-400 text-xs uppercase tracking-widest font-black">Total Wealth</span>
                    <span className="text-white text-3xl font-black tracking-tight mt-1">₹{stats.totalCurrentValue >= 10000000 ? (stats.totalCurrentValue/10000000).toFixed(2) + 'Cr' : stats.totalCurrentValue >= 100000 ? (stats.totalCurrentValue/100000).toFixed(2) + 'L' : formatMoney(stats.totalCurrentValue)}</span>
                  </div>
                </div>
              ) : (
                <div className="w-[260px] h-[260px] rounded-full border-2 border-dashed border-white/15 backdrop-blur-md bg-white/[0.01] flex flex-col items-center justify-center gap-3 p-4 text-center relative z-10">
                  <span className="text-xs text-gray-400 font-black uppercase tracking-wider">No MF Holdings</span>
                  <button
                    onClick={() => {
                      setFormData({
                        fund_name: "", scheme_code: "", units: "", nav: "", current_nav: "",
                        investment_type: "SIP", category: "Equity", amc_name: "HDFC",
                        date: new Date().toISOString().split("T")[0], account_id: "", trade_type: "buy"
                      });
                      setEditingId(null);
                      setShowAddModal(true);
                    }}
                    className="bg-[var(--accent-primary)] text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider hover:brightness-110 transition-all shadow-lg shadow-[var(--accent-primary)]/20 cursor-pointer"
                  >
                    + Invest Now
                  </button>
                </div>
              )}
              
              {pieChartData.length > 0 && (
                <div className="flex flex-wrap justify-center gap-4 mt-8 relative z-10">
                  {pieChartData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl backdrop-blur-md">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                      <span className="text-xs text-gray-300 font-bold">{entry.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Stats Summary Card */}
            <div className="flex-1 flex flex-col justify-center glass-card-static backdrop-blur-2xl bg-white/[0.03] border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="space-y-6 relative z-10">
                <div>
                  <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">Current Value</p>
                  <p className="text-4xl font-black text-white tracking-tight">₹{formatMoney(stats.totalCurrentValue)}</p>
                </div>
                
                <div>
                  <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">Invested Value</p>
                  <p className="text-2xl font-bold text-gray-300">₹{formatMoney(stats.totalInvested)}</p>
                </div>

                <div className="h-px w-full bg-white/10" />

                <div className="grid grid-cols-2 gap-8">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
                    <p className="text-[0.65rem] text-gray-400 font-black uppercase tracking-widest mb-1">Total Returns</p>
                    <div className={`text-xl font-black ${stats.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {stats.totalPnL >= 0 ? '+' : ''}₹{formatMoney(stats.totalPnL)}
                      <div className="text-xs font-black mt-0.5 opacity-90">{stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(2)}%</div>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
                    <p className="text-[0.65rem] text-gray-400 font-black uppercase tracking-widest mb-1">Day&apos;s Returns</p>
                    <div className={`text-xl font-black ${stats.dayPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {stats.dayPnL >= 0 ? '+' : ''}₹{formatMoney(stats.dayPnL)}
                      <div className="text-xs font-black mt-0.5 opacity-90">{stats.dayPnLPercent >= 0 ? '+' : ''}{stats.dayPnLPercent.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "holdings" && (
          <div className="animate-in fade-in mt-4">
            <MutualFundsDataTable 
              funds={mutualFunds} 
              onEdit={startEdit} 
              onBuy={startBuy}
              onSell={startSell}
              onAdd={() => setShowAddModal(true)} 
            />
          </div>
        )}

        {activeTab === "history" && (
          <div className="animate-in fade-in mt-4">
            <MFHistoryTable trades={mutualFundTrades} />
          </div>
        )}
      </div>

      {/* Coin style Lumpsum/SIP Invest & Redeem Modal */}
      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingId(null); }}
          title={editingId ? `Update ${formData.fund_name}` : "Investment Ticket"}
        >
          {/* Custom Coin styling */}
          <div className="p-0 -mx-6 -mt-6">
            <div className={`p-4 rounded-t flex items-center justify-between ${
              formData.trade_type === "buy" ? "bg-[var(--accent-primary)]" : "bg-[#ff5722]"
            } text-white`}>
              <div>
                <span className="text-base font-bold uppercase tracking-wider">{editingId ? "Modify" : formData.trade_type === "buy" ? "Invest" : "Redeem"} {formData.fund_name || "Fund"}</span>
                <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded font-black tracking-widest">COIN</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-white/70">LTP NAV</span>
                <span className="ml-1 text-sm font-bold">₹{parseFloat(formData.current_nav || "0").toFixed(4)}</span>
              </div>
            </div>

            <div className="p-5 space-y-5 bg-[var(--bg-card)]">
              {/* Investment type toggle (SIP vs Lumpsum) */}
              {!editingId && formData.trade_type === "buy" && (
                <div className="flex bg-[var(--bg-card)] rounded p-1 border border-white/5">
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, investment_type: "SIP" })}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
                      formData.investment_type === "SIP" ? "bg-[var(--accent-primary)] text-white shadow-md" : "text-gray-500 hover:text-white"
                    }`}
                  >
                    SIP Mode
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, investment_type: "LUMPSUM" })}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
                      formData.investment_type === "LUMPSUM" ? "bg-[var(--accent-primary)] text-white shadow-md" : "text-gray-500 hover:text-white"
                    }`}
                  >
                    Lumpsum Mode
                  </button>
                </div>
              )}

              <form onSubmit={handleAddMF} className="space-y-4">
                {/* Search / Manual Fund Selection */}
                {!formData.scheme_code ? (
                  <div className="space-y-1.5 relative">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Search or Enter Fund Name</label>
                    <div className="relative">
                      <input 
                        className="w-full bg-[#181A20] border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-[#FF5722] placeholder-gray-500 font-medium" 
                        placeholder="e.g. Parag Parikh Flexi Cap" 
                        value={searchQuery || formData.fund_name} 
                        onChange={e => {
                          setSearchQuery(e.target.value);
                          setFormData({...formData, fund_name: e.target.value});
                        }} 
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-2.5">
                          <svg className="w-3.5 h-3.5 animate-spin text-[#FF5722]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                        </div>
                      )}
                    </div>

                    {showSearchDropdown && (
                      <div className="absolute z-[120] left-0 right-0 top-[100%] mt-1 bg-[#181A20] border border-[#FF5722]/40 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto custom-scrollbar">
                        {searchResults.map((res, i) => (
                          <div 
                            key={i} 
                            className="px-3.5 py-2.5 hover:bg-[#FF5722]/10 cursor-pointer transition-colors border-b border-white/5 last:border-0 flex items-center justify-between gap-3"
                            onClick={async () => {
                              const derivedAmc = res.schemeName.trim().split(" ")[0];
                              setFormData({
                                ...formData, 
                                fund_name: res.schemeName, 
                                scheme_code: res.schemeCode,
                                amc_name: derivedAmc
                              });
                              setSearchQuery("");
                              setShowSearchDropdown(false);
                              if (res.schemeCode) {
                                const liveData = await fetchLiveMFNAV(res.schemeCode);
                                if (liveData) {
                                  setFormData(prev => ({
                                    ...prev, 
                                    current_nav: liveData.nav.toString(),
                                    nav: prev.nav ? prev.nav : liveData.nav.toString()
                                  }));
                                }
                              }
                            }}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <AMCAvatar amcName="" fundName={res.schemeName} />
                              <span className="text-xs font-bold text-white truncate">{res.schemeName}</span>
                            </div>
                            <span className="text-[0.625rem] font-bold text-[#FF5722] bg-[#FF5722]/10 px-1.5 py-0.5 rounded shrink-0">{res.schemeCode}</span>
                          </div>
                        ))}
                        {formData.fund_name.trim().length > 0 && (
                          <div 
                            className="px-3.5 py-2.5 bg-[#FF5722]/20 hover:bg-[#FF5722]/30 cursor-pointer transition-colors border-t border-[#FF5722]/30 flex items-center justify-between"
                            onClick={() => {
                              setShowSearchDropdown(false);
                              if (!formData.scheme_code) {
                                setFormData(prev => ({ ...prev, scheme_code: "MANUAL-" + Date.now() }));
                              }
                            }}
                          >
                            <span className="text-xs font-black text-white uppercase tracking-wider">Use &quot;{formData.fund_name}&quot; Manually</span>
                            <span className="text-[0.625rem] bg-[#FF5722] text-white px-2 py-0.5 rounded font-black">✓ SELECT</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Selected Fund Card with AMC Logo */
                  <div className="bg-[#181A20] border border-[#FF5722]/30 p-3.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AMCAvatar amcName={formData.amc_name} fundName={formData.fund_name} />
                      <div>
                        <p className="text-xs font-bold text-white">{formData.fund_name}</p>
                        <p className="text-[0.6875rem] text-[#FF5722] font-semibold">Scheme Code: {formData.scheme_code}</p>
                      </div>
                    </div>
                    {!editingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, scheme_code: "", fund_name: "" }));
                        }}
                        className="text-xs bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white px-2 py-1 rounded transition-all font-bold"
                      >
                        Change Fund
                      </button>
                    )}
                  </div>
                )}

                {/* Hidden auto-fetched field */}
                <input type="hidden" value={formData.current_nav} />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Units</label>
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      className="w-full bg-[var(--bg-card)] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[var(--accent-primary)]" 
                      value={formData.units} 
                      onChange={e => setFormData({...formData, units: e.target.value})} 
                      inputMode="decimal" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      {formData.trade_type === 'buy' ? 'Purchase NAV' : 'Redemption NAV'}
                    </label>
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      className="w-full bg-[var(--bg-card)] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[var(--accent-primary)]" 
                      value={formData.nav} 
                      onChange={e => setFormData({...formData, nav: e.target.value})} 
                      inputMode="decimal" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Category</label>
                    <select 
                      className="w-full bg-[var(--bg-card)] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[var(--accent-primary)]" 
                      value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    >
                      <option value="Equity">Equity</option>
                      <option value="Debt">Debt</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Liquid">Liquid</option>
                      <option value="Index">Index</option>
                      <option value="ELSS">ELSS</option>
                    </select>
                  </div>
                </div>

                <details className="group border border-white/5 bg-white/[0.02] rounded-xl overflow-hidden mt-4">
                  <summary className="text-xs font-bold text-gray-400 p-3 cursor-pointer outline-none hover:text-white transition-colors bg-white/[0.02]">
                    Advanced Options (AMC, Scheme Code)
                  </summary>
                  <div className="p-3 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">AMC/Provider</label>
                      <input 
                        className="w-full bg-[var(--bg-card)] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[var(--accent-primary)]" 
                        placeholder="e.g. PPFAS" 
                        value={formData.amc_name} 
                        onChange={e => setFormData({...formData, amc_name: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Scheme Code</label>
                      <input 
                        className="w-full bg-[var(--bg-card)] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[var(--accent-primary)]" 
                        placeholder="e.g. 122639" 
                        value={formData.scheme_code} 
                        onChange={e => setFormData({...formData, scheme_code: e.target.value})} 
                      />
                    </div>
                  </div>
                </details>

                {!editingId && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date</label>
                        <input 
                          type="date" 
                          className="w-full bg-[var(--bg-card)] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[var(--accent-primary)]" 
                          value={formData.date} 
                          onChange={e => setFormData({...formData, date: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                          {formData.trade_type === 'buy' ? 'Deduct From' : 'Deposit To'}
                        </label>
                        <select 
                          className="w-full bg-[var(--bg-card)] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#FF5722]" 
                          value={formData.account_id} 
                          onChange={e => setFormData({...formData, account_id: e.target.value})}
                        >
                          <option value="" disabled className="bg-[#181A20] text-white font-medium">Select Account</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id} className="bg-[#181A20] text-white font-medium">{acc.name} (₹{acc.balance.toLocaleString()})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                {/* Zerodha Coin Direct MF Tax Calculation Details */}
                {((parseFloat(formData.units) || 0) > 0) && (
                  <div className="bg-[#181A20] rounded-xl border border-[#FF5722]/30 p-3.5 flex flex-col gap-2 text-xs mt-4">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <span className="font-extrabold text-[#FF5722] uppercase tracking-wider text-[0.6875rem]">Coin Direct MF Tax Slip</span>
                      <span className="text-[0.625rem] bg-[#FF5722]/20 text-[#FF5722] px-2 py-0.5 rounded font-black uppercase">0% Commission</span>
                    </div>

                    {(() => {
                      const u = parseFloat(formData.units) || 0;
                      const n = parseFloat(formData.nav) || 0;
                      const turnover = u * n;
                      const isBuy = formData.trade_type === "buy";
                      const calc = calculateMutualFundCharges(turnover, isBuy);
                      const currentCharges = parseFloat(charges) || 0;

                      return (
                        <>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">Total Investment Value:</span>
                            <span className="text-white font-bold">₹{turnover.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center text-[0.6875rem] text-gray-400">
                            <span>Brokerage:</span>
                            <span className="text-emerald-400 font-bold">₹0.00 (Direct MF)</span>
                          </div>
                          <div className="flex justify-between items-center text-[0.6875rem] text-gray-400">
                            <span>{isBuy ? "Government Stamp Duty (0.005%)" : "STT Redemption (0.001%)"}:</span>
                            <span className="text-white font-mono">₹{(isBuy ? calc.stampDuty : calc.stt).toFixed(2)}</span>
                          </div>

                          {/* Prominent Auto-Calculated Total Charges Display & Edit Row */}
                          <div className="flex justify-between items-center bg-[#252525] px-3.5 py-2.5 rounded-xl border border-[#FF5722]/30 mt-1">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-200 font-extrabold text-[0.6875rem] uppercase tracking-wider">Total Charges / Stamp Duty:</span>
                              {!isCustomCharges ? (
                                <span className="text-[0.5625rem] bg-[#FF5722]/20 text-[#FF5722] border border-[#FF5722]/30 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">
                                  Auto-Calculated
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCustomCharges(false);
                                    const calcRef = calculateMutualFundCharges(turnover, isBuy);
                                    setCharges(calcRef.totalCharges.toString());
                                  }}
                                  className="text-[0.625rem] text-[#FF5722] hover:underline font-bold"
                                >
                                  (Reset)
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-white font-mono font-extrabold text-sm">
                                ₹{isCustomCharges ? (parseFloat(charges) || 0).toFixed(2) : calc.totalCharges.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isCustomCharges) {
                                    setIsCustomCharges(true);
                                    setCharges(calc.totalCharges.toString());
                                  }
                                }}
                                className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                                title="Manual Edit Charges"
                              >
                                ✏️
                              </button>
                            </div>
                          </div>

                          {isCustomCharges && (
                            <div className="flex items-center justify-between gap-2 bg-[#181A20] p-2 rounded-lg border border-[#FF5722]/50 animate-fade-in">
                              <span className="text-[0.6875rem] text-gray-400 font-semibold">Custom Manual Charges (₹):</span>
                              <input
                                type="number"
                                step="0.01"
                                value={charges}
                                onChange={(e) => {
                                  setIsCustomCharges(true);
                                  setCharges(e.target.value);
                                }}
                                className="w-28 bg-[#252525] border border-[#FF5722] rounded px-2.5 py-1 text-xs text-white font-mono font-bold outline-none text-right"
                                placeholder="0.00"
                              />
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t border-white/10 font-black text-xs">
                            <span className="text-white">Estimated Net {isBuy ? 'Outflow' : 'Inflow'}:</span>
                            <span className={isBuy ? 'text-[#FF5722]' : 'text-emerald-400'}>
                              ₹{(isBuy ? turnover + currentCharges : turnover - currentCharges).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Modal actions */}
                <div className="flex gap-3 pt-2">
                  <button 
                    type="submit" 
                    disabled={submitting} 
                    className={`flex-1 py-2 rounded text-xs font-bold transition-all text-white shadow-md active:scale-[0.98] ${
                      editingId ? "bg-indigo-600 hover:bg-indigo-700" :
                      formData.trade_type === 'sell' ? "bg-[#ff5722] hover:bg-[#e64a19]" : "bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
                    }`}
                  >
                    {submitting ? "Processing..." : (editingId ? "Modify" : formData.trade_type === 'buy' ? "Invest Now" : "Redeem Now")}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setShowAddModal(false); setEditingId(null); }} 
                    className="px-4 py-2 rounded text-xs font-bold bg-[#333] hover:bg-[#444] text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
