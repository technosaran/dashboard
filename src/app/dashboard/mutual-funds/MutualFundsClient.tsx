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

import MutualFundsDataTable from "./components/MutualFundsDataTable";
import MFHistoryTable from "./components/MFHistoryTable";

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

  const [formData, setFormData] = useState({
    fund_name: "",
    scheme_code: "",
    units: "",
    nav: "",
    current_nav: "",
    investment_type: "SIP",
    category: "Equity",
    amc_name: "HDFC",
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
      if (defaultAccExists) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, account_id: defaultAccId }));
        }, 0);
      }
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
        if (!mf.scheme_code) continue;
        const liveData = await fetchLiveMFNAV(mf.scheme_code);
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
      handleRefreshNAV();
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
    <div className="flex flex-col animate-in fade-in duration-700 w-full bg-[#121212] min-h-screen text-[#ddd]">
      {/* Coin-style Top Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-[#151515]">
        <div className="flex items-center gap-8">
          <button 
            onClick={() => setActiveTab("dashboard")} 
            className={`text-sm font-bold transition-colors tracking-wider uppercase ${activeTab === "dashboard" ? "text-[#2185d0]" : "text-gray-400 hover:text-white"}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab("holdings")} 
            className={`text-sm font-bold transition-colors tracking-wider uppercase ${activeTab === "holdings" ? "text-[#2185d0]" : "text-gray-400 hover:text-white"}`}
          >
            Holdings
          </button>
          <button 
            onClick={() => setActiveTab("history")} 
            className={`text-sm font-bold transition-colors tracking-wider uppercase ${activeTab === "history" ? "text-[#2185d0]" : "text-gray-400 hover:text-white"}`}
          >
            Transactions
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefreshNAV} 
            disabled={isRefreshing || rawMfs.length === 0}
            className="bg-transparent border border-white/10 hover:bg-white/5 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isRefreshing ? (
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
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
            className="bg-[#2185d0] hover:bg-[#1678c2] text-white px-4 py-1.5 rounded text-xs font-bold transition-colors"
          >
            Invest Now
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl w-full mx-auto">
        {activeTab === "dashboard" && (
          <div className="flex flex-col lg:flex-row gap-12 items-center lg:items-stretch mt-4">
            {/* Left: Large Allocation Donut */}
            <div className="flex-1 flex flex-col items-center justify-center bg-[#151515] p-8 border border-white/5 rounded-lg">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Asset Allocation</h3>
              {mounted && pieChartData.length > 0 ? (
                <div className="w-[280px] h-[280px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={2} dataKey="value" stroke="none">
                        {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "#1e1e1e", border: "1px solid #333", borderRadius: "4px" }}
                        itemStyle={{ color: "#fff", fontSize: "11px" }}
                        formatter={(value) => [`₹${Number(value).toLocaleString()}`, "Value"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">Total Wealth</span>
                    <span className="text-white text-2xl font-normal mt-1">₹{stats.totalCurrentValue >= 10000000 ? (stats.totalCurrentValue/10000000).toFixed(2) + 'Cr' : stats.totalCurrentValue >= 100000 ? (stats.totalCurrentValue/100000).toFixed(2) + 'L' : formatMoney(stats.totalCurrentValue)}</span>
                  </div>
                </div>
              ) : (
                <div className="w-[250px] h-[250px] rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">No MF Holdings</span>
                </div>
              )}
              
              {pieChartData.length > 0 && (
                <div className="flex flex-wrap justify-center gap-4 mt-8">
                  {pieChartData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                      <span className="text-xs text-gray-400 font-semibold">{entry.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Coin Stats summary */}
            <div className="flex-1 flex flex-col justify-center bg-[#151515] p-8 border border-white/5 rounded-lg">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Current value</p>
                  <p className="text-3xl font-normal text-white">₹{formatMoney(stats.totalCurrentValue)}</p>
                </div>
                
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Invested value</p>
                  <p className="text-xl font-normal text-white/90">₹{formatMoney(stats.totalInvested)}</p>
                </div>

                <div className="h-px w-full bg-white/5" />

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total returns</p>
                    <div className={`text-lg font-bold ${stats.totalPnL >= 0 ? 'text-[#4caf50]' : 'text-[#f44336]'}`}>
                      {stats.totalPnL >= 0 ? '+' : ''}₹{formatMoney(stats.totalPnL)}
                      <div className="text-xs font-semibold mt-0.5 opacity-90">{stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(2)}%</div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Day&apos;s returns</p>
                    <div className={`text-lg font-bold ${stats.dayPnL >= 0 ? 'text-[#4caf50]' : 'text-[#f44336]'}`}>
                      {stats.dayPnL >= 0 ? '+' : ''}₹{formatMoney(stats.dayPnL)}
                      <div className="text-xs font-semibold mt-0.5 opacity-90">{stats.dayPnLPercent >= 0 ? '+' : ''}{stats.dayPnLPercent.toFixed(2)}%</div>
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
              formData.trade_type === "buy" ? "bg-[#2185d0]" : "bg-[#ff5722]"
            } text-white`}>
              <div>
                <span className="text-base font-bold uppercase tracking-wider">{editingId ? "Modify" : formData.trade_type === "buy" ? "Invest" : "Redeem"} {formData.fund_name || "Fund"}</span>
                <span className="ml-2 text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-black tracking-widest">COIN</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-white/70">LTP NAV</span>
                <span className="ml-1 text-sm font-bold">₹{parseFloat(formData.current_nav || "0").toFixed(4)}</span>
              </div>
            </div>

            <div className="p-5 space-y-5 bg-[#151515]">
              {/* Investment type toggle (SIP vs Lumpsum) */}
              {!editingId && formData.trade_type === "buy" && (
                <div className="flex bg-[#202020] rounded p-1 border border-white/5">
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, investment_type: "SIP" })}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
                      formData.investment_type === "SIP" ? "bg-[#2185d0] text-white shadow-md" : "text-gray-500 hover:text-white"
                    }`}
                  >
                    SIP Mode
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData({ ...formData, investment_type: "LUMPSUM" })}
                    className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all ${
                      formData.investment_type === "LUMPSUM" ? "bg-[#2185d0] text-white shadow-md" : "text-gray-500 hover:text-white"
                    }`}
                  >
                    Lumpsum Mode
                  </button>
                </div>
              )}

              <form onSubmit={handleAddMF} className="space-y-4">
                {/* Search Fund (Only when adding from scratch) */}
                {!formData.scheme_code && (
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Search Fund</label>
                    <div className="relative">
                      <input 
                        className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                        placeholder="e.g. Parag Parikh Flexi Cap" 
                        value={searchQuery || formData.fund_name} 
                        onChange={e => {
                          setSearchQuery(e.target.value);
                          setFormData({...formData, fund_name: e.target.value});
                        }} 
                      />
                      {isSearching && (
                        <div className="absolute right-3 top-2">
                          <svg className="w-3.5 h-3.5 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                        </div>
                      )}
                    </div>
                    {showSearchDropdown && searchResults.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-[100%] mt-1 bg-[#202020] border border-white/10 rounded shadow-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                        {searchResults.map((res, i) => (
                          <div 
                            key={i} 
                            className="px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0"
                            onClick={async () => {
                              setFormData({...formData, fund_name: res.schemeName, scheme_code: res.schemeCode});
                              setSearchQuery("");
                              setShowSearchDropdown(false);
                              if (res.schemeCode) {
                                const liveData = await fetchLiveMFNAV(res.schemeCode);
                                if (liveData) {
                                  setFormData(prev => ({...prev, current_nav: liveData.nav.toString()}));
                                }
                              }
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white truncate max-w-[80%]">{res.schemeName}</span>
                              <span className="text-[10px] font-bold text-[#2185d0]">{res.schemeCode}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">AMC/Provider</label>
                    <input 
                      required 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      placeholder="e.g. PPFAS" 
                      value={formData.amc_name} 
                      onChange={e => setFormData({...formData, amc_name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Scheme Code</label>
                    <input 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      placeholder="e.g. 122639" 
                      value={formData.scheme_code} 
                      onChange={e => setFormData({...formData, scheme_code: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Units</label>
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      value={formData.units} 
                      onChange={e => setFormData({...formData, units: e.target.value})} 
                      inputMode="decimal" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                      {formData.trade_type === 'buy' ? 'Purchase NAV' : 'Redemption NAV'}
                    </label>
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      value={formData.nav} 
                      onChange={e => setFormData({...formData, nav: e.target.value})} 
                      inputMode="decimal" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Current NAV</label>
                    <input 
                      required 
                      type="number" 
                      step="any" 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                      value={formData.current_nav} 
                      onChange={e => setFormData({...formData, current_nav: e.target.value})} 
                      inputMode="decimal" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Category</label>
                    <select 
                      className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
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

                {!editingId && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Date</label>
                        <input 
                          type="date" 
                          className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                          value={formData.date} 
                          onChange={e => setFormData({...formData, date: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Stamp Duty / Charges (₹)</label>
                        <input 
                          type="number" 
                          step="any" 
                          className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                          placeholder="0.00"
                          value={charges} 
                          onChange={e => setCharges(e.target.value)} 
                          inputMode="decimal" 
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                        {formData.trade_type === 'buy' ? 'Deduct From' : 'Deposit To'}
                      </label>
                      <select 
                        className="w-full bg-[#202020] border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none focus:border-[#2185d0]" 
                        value={formData.account_id} 
                        onChange={e => setFormData({...formData, account_id: e.target.value})}
                      >
                        <option value="">No Account (Track Only)</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Live Margin Calculation details */}
                <div className="bg-white/5 rounded p-3 flex flex-col gap-1.5 text-xs text-gray-400">
                  <div className="flex justify-between items-center">
                    <span>Turnover:</span>
                    <span className="text-white font-medium">
                      ₹{formatMoney((parseFloat(formData.units) || 0) * (parseFloat(formData.nav) || 0))}
                    </span>
                  </div>
                  {parseFloat(charges) > 0 && (
                    <div className="flex justify-between items-center">
                      <span>Charges / Stamp Duty:</span>
                      <span className="text-white font-medium">
                        ₹{formatMoney(parseFloat(charges))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1.5 border-t border-white/5 font-bold">
                    <span>Net Amount:</span>
                    <span className="text-white">
                      ₹{formatMoney(
                        formData.trade_type === 'buy'
                          ? ((parseFloat(formData.units) || 0) * (parseFloat(formData.nav) || 0)) + (parseFloat(charges) || 0)
                          : ((parseFloat(formData.units) || 0) * (parseFloat(formData.nav) || 0)) - (parseFloat(charges) || 0)
                      )}
                    </span>
                  </div>
                </div>

                {/* Modal actions */}
                <div className="flex gap-3 pt-2">
                  <button 
                    type="submit" 
                    disabled={submitting} 
                    className={`flex-1 py-2 rounded text-xs font-bold transition-all text-white shadow-md active:scale-[0.98] ${
                      editingId ? "bg-indigo-600 hover:bg-indigo-700" :
                      formData.trade_type === 'sell' ? "bg-[#ff5722] hover:bg-[#e64a19]" : "bg-[#2185d0] hover:bg-[#1678c2]"
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
