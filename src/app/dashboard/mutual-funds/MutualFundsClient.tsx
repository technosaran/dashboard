"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import type { Tables } from "@/lib/database.types";
import { recordMFInvestment, updateMFHolding, searchMFSchemes, fetchLiveMFNAV } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";

import MutualFundsDataTable from "./components/MutualFundsDataTable";

type MF = Tables<"mutual_funds"> & { scheme_code?: string | null; fund_symbol?: string | null; pnlPercent?: number; day_change?: number; day_change_percent?: number };

const getColorByLabel = (label: string) => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = label.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#2185d0", "#f2711c", "#a333c8", "#21ba45", "#e03997", 
    "#fbbd08", "#6435c9", "#db2828", "#00b5ad", "#b5cc18"
  ];
  return colors[Math.abs(hash) % colors.length];
};

export default function MutualFundsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { mutualFunds: rawMfs, accounts, profile }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Coin uses Dashboard, Mutual Funds (Holdings, Orders)
  const [activeTab, setActiveTab] = useState<"dashboard" | "holdings">("dashboard");

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
  const [searchResults, setSearchResults] = useState<any[]>([]);
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
        units: mf.units.toString(),
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
        const liveNAV = await fetchLiveMFNAV(mf.scheme_code);
        if (liveNAV && liveNAV !== mf.current_nav) {
          await updateMFHolding(mf.id, { current_nav: liveNAV });
          updated++;
        }
      }
      if (updated > 0) {
        mutate();
        toast.success(`Refreshed live NAVs for ${updated} funds!`);
      } else {
        toast.success("NAVs are already up to date.");
      }
    } catch (e) {
      toast.error("Failed to refresh some NAVs");
    } finally {
      setIsRefreshing(false);
    }
  };

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
          
          const qty = parseFloat(formData.units);
          const price = parseFloat(formData.nav);
          const amt = qty * price;
          const chargeAmt = parseFloat(charges) || 0;
          const finalNet = formData.trade_type === 'buy' ? amt + chargeAmt : amt - chargeAmt;
          
          const res = await recordMFInvestment({
            fund_name: formData.fund_name,
            amc_name: formData.amc_name,
            scheme_code: formData.scheme_code,
            units: qty,
            nav: price,
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
    <div className="flex flex-col animate-in fade-in duration-700 w-full bg-[#f9f9f9] dark:bg-[#121212] min-h-screen text-[#444] dark:text-[#ddd]">
      {/* Coin-style Top Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-[#eee] dark:border-white/10 bg-white dark:bg-[#0a0a0a]">
        <div className="flex items-center gap-8">
          <button 
            onClick={() => setActiveTab("dashboard")} 
            className={`text-2xl font-normal transition-colors ${activeTab === "dashboard" ? "text-black dark:text-white" : "text-gray-400 hover:text-black dark:hover:text-white"}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab("holdings")} 
            className={`text-2xl font-normal transition-colors ${activeTab === "holdings" ? "text-black dark:text-white" : "text-gray-400 hover:text-black dark:hover:text-white"}`}
          >
            Mutual Funds
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleRefreshNAV} 
            disabled={isRefreshing || rawMfs.length === 0}
            className="bg-transparent border border-[#ccc] dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 text-[#444] dark:text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isRefreshing ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
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
            className="bg-[#2185d0] hover:bg-[#1678c2] text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
          >
            Invest
          </button>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto w-full">
        {activeTab === "dashboard" && (
          <div className="flex flex-col md:flex-row gap-12 animate-in fade-in">
            {/* Left: Large Donut Chart */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {mounted && pieChartData.length > 0 ? (
                <div className="w-[350px] h-[350px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={100} outerRadius={140} paddingAngle={2} dataKey="value" stroke="none">
                        {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "#1e1e1e", border: "1px solid #333", borderRadius: "4px" }}
                        itemStyle={{ color: "#fff", fontSize: "12px" }}
                        formatter={(value: any) => [`₹${formatMoney(Number(value))}`, "Value"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-gray-500 dark:text-[#888] text-sm uppercase tracking-widest font-medium">Portfolio</span>
                    <span className="text-black dark:text-white text-3xl font-medium mt-1">₹{stats.totalCurrentValue >= 10000000 ? (stats.totalCurrentValue/10000000).toFixed(2) + 'Cr' : stats.totalCurrentValue >= 100000 ? (stats.totalCurrentValue/100000).toFixed(2) + 'L' : formatMoney(stats.totalCurrentValue)}</span>
                  </div>
                </div>
              ) : (
                <div className="w-[350px] h-[350px] rounded-full border-4 border-dashed border-gray-300 dark:border-white/10 flex items-center justify-center">
                  <span className="text-gray-400 dark:text-gray-600">No investments yet</span>
                </div>
              )}
              
              {pieChartData.length > 0 && (
                <div className="flex flex-wrap justify-center gap-4 mt-8">
                  {pieChartData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                      <span className="text-sm text-gray-700 dark:text-[#bbb]">{entry.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Clean Summary (Coin Style) */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="bg-white dark:bg-[#121212] rounded-xl shadow-sm border border-[#eee] dark:border-white/10 p-8">
                <div className="mb-8">
                  <p className="text-sm text-gray-500 dark:text-[#888] font-medium mb-1">Current value</p>
                  <p className="text-4xl font-normal text-black dark:text-white">₹{formatMoney(stats.totalCurrentValue)}</p>
                </div>
                
                <div className="mb-8">
                  <p className="text-sm text-gray-500 dark:text-[#888] font-medium mb-1">Invested value</p>
                  <p className="text-2xl font-normal text-black dark:text-white">₹{formatMoney(stats.totalInvested)}</p>
                </div>

                <div className="h-px w-full bg-[#eee] dark:bg-white/10 mb-8" />

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-[#888] font-medium mb-1">Total returns</p>
                    <div className={`text-xl font-medium ${stats.totalPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {stats.totalPnL >= 0 ? '+' : ''}₹{formatMoney(stats.totalPnL)}
                      <div className="text-sm font-normal opacity-90">{stats.totalPnLPercent >= 0 ? '+' : ''}{stats.totalPnLPercent.toFixed(2)}%</div>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-[#888] font-medium mb-1">1D returns</p>
                    <div className={`text-xl font-medium ${stats.dayPnL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {stats.dayPnL >= 0 ? '+' : ''}₹{formatMoney(stats.dayPnL)}
                      <div className="text-sm font-normal opacity-90">{stats.dayPnLPercent >= 0 ? '+' : ''}{stats.dayPnLPercent.toFixed(2)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "holdings" && (
          <div className="animate-in fade-in">
            <MutualFundsDataTable 
              funds={mutualFunds} 
              onEdit={startEdit} 
              onSell={startSell}
              onAdd={() => setShowAddModal(true)} 
            />
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingId(null); }}
          title={editingId ? "Update Fund Holding" : "Invest in Mutual Fund"}
        >
          <div className="p-2 max-w-lg mx-auto w-full">
            {!editingId && (
              <div className="flex bg-gray-100 dark:bg-[#1e1e1e] rounded-md p-1 border border-transparent dark:border-white/10 mb-6">
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, trade_type: "buy" })}
                  className={`flex-1 py-2 rounded text-xs font-semibold transition-all ${
                    formData.trade_type === "buy" ? "bg-[#2185d0] text-white shadow-sm" : "text-gray-500 dark:text-[--text-muted]"
                  }`}
                >
                  Buy / Invest
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({ ...formData, trade_type: "sell" })}
                  className={`flex-1 py-2 rounded text-xs font-semibold transition-all ${
                    formData.trade_type === "sell" ? "bg-rose-500 text-white shadow-sm" : "text-gray-500 dark:text-[--text-muted]"
                  }`}
                >
                  Sell / Redeem
                </button>
              </div>
            )}

            <form onSubmit={handleAddMF} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2 relative">
                  <label className="text-xs font-medium text-gray-500 dark:text-[--text-muted]">Search Fund</label>
                  <div className="relative">
                    <input 
                      className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-black dark:text-white focus:border-[#2185d0] outline-none" 
                      placeholder="e.g. Parag Parikh Flexi Cap" 
                      value={searchQuery || formData.fund_name} 
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        setFormData({...formData, fund_name: e.target.value});
                      }} 
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-2.5">
                        <svg className="w-4 h-4 animate-spin text-gray-400 dark:text-[--text-muted]" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path></svg>
                      </div>
                    )}
                  </div>
                  {showSearchDropdown && searchResults.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-[100%] mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-white/10 rounded-md shadow-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                      {searchResults.map((res, i) => (
                        <div 
                          key={i} 
                          className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors border-b border-gray-100 dark:border-white/5 last:border-0"
                          onClick={async () => {
                            setFormData({...formData, fund_name: res.schemeName, scheme_code: res.schemeCode});
                            setSearchQuery("");
                            setShowSearchDropdown(false);
                            // Auto fetch current NAV
                            if (res.schemeCode) {
                              const liveNAV = await fetchLiveMFNAV(res.schemeCode);
                              if (liveNAV) {
                                setFormData(prev => ({...prev, current_nav: liveNAV.toString()}));
                              }
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-800 dark:text-white truncate max-w-[80%]">{res.schemeName}</span>
                            <span className="text-xs font-bold text-[#2185d0]">{res.schemeCode}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-[--text-muted]">AMC Name</label>
                  <input required className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-black dark:text-white focus:border-[#2185d0] outline-none" placeholder="e.g. PPFAS" value={formData.amc_name} onChange={e => setFormData({...formData, amc_name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-[--text-muted]">Scheme Code</label>
                  <input className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-black dark:text-white focus:border-[#2185d0] outline-none" placeholder="e.g. 122639" value={formData.scheme_code} onChange={e => setFormData({...formData, scheme_code: e.target.value})} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-[--text-muted]">Units</label>
                  <input required type="number" step="any" className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-black dark:text-white focus:border-[#2185d0] outline-none" value={formData.units} onChange={e => setFormData({...formData, units: e.target.value})} inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-[--text-muted]">{formData.trade_type === 'buy' ? 'Purchase NAV' : 'Redemption NAV'}</label>
                  <input required type="number" step="any" className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-black dark:text-white focus:border-[#2185d0] outline-none" value={formData.nav} onChange={e => setFormData({...formData, nav: e.target.value})} inputMode="decimal" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-[--text-muted]">Current NAV</label>
                  <input required type="number" step="any" className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-black dark:text-white focus:border-[#2185d0] outline-none" value={formData.current_nav} onChange={e => setFormData({...formData, current_nav: e.target.value})} inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-[--text-muted]">Category</label>
                  <select className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-black dark:text-white focus:border-[#2185d0] outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
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
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500 dark:text-[--text-muted]">Transaction Date</label>
                    <input type="date" className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-black dark:text-white focus:border-[#2185d0] outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500 dark:text-[--text-muted]">Investment Type</label>
                    <select className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-black dark:text-white focus:border-[#2185d0] outline-none" value={formData.investment_type} onChange={e => setFormData({...formData, investment_type: e.target.value})}>
                      <option value="SIP">SIP</option>
                      <option value="LUMPSUM">Lumpsum</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-[--text-muted]">
                    {formData.trade_type === 'buy' ? 'Deduct From' : 'Deposit To'}
                  </label>
                  <select className="w-full bg-white dark:bg-[#1e1e1e] border border-gray-300 dark:border-white/10 rounded px-3 py-2 text-sm text-black dark:text-white focus:border-[#2185d0] outline-none" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                    <option value="">No Account (Track Only)</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                    ))}
                  </select>
                </div>
                </>
              )}

              <div className="pt-6">
                <button type="submit" disabled={submitting} className={`w-full py-2.5 rounded text-sm font-semibold transition-colors ${!editingId && formData.trade_type === 'sell' ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-[#2185d0] hover:bg-[#1678c2] text-white'}`}>
                  {submitting ? "Processing..." : (editingId ? "Update" : formData.trade_type === 'buy' ? "Invest" : "Redeem")}
                </button>
              </div>
            </form>
          </div>
        </Drawer>
      )}
    </div>
  );
}
