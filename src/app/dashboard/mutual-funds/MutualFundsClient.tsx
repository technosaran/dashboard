
"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import Image from "next/image";

import type { Tables } from "@/lib/database.types";
import { recordMFInvestment, updateMFHolding } from "./actions";
import { revertLedgerLog } from "../alternative-assets/actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { useMediaQuery } from "@/hooks/use-media-query";
import Link from "next/link";
import PnLValue from "@/components/pnl-value";
import { exportToCSV } from "@/lib/export-csv";

type MF = Tables<"mutual_funds"> & { scheme_code?: string | null; fund_symbol?: string | null; pnlPercent?: number };


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
  if (amc.includes('canara')) return 'https://logo.clearbit.com/canararobeco.com';
  if (amc.includes('invesco')) return 'https://logo.clearbit.com/invescomutualfund.com';
  if (amc.includes('lic')) return 'https://logo.clearbit.com/licmf.com';
  if (amc.includes('mahindra')) return 'https://logo.clearbit.com/mahindramanulife.com';
  if (amc.includes('union')) return 'https://logo.clearbit.com/unionmf.com';
  if (amc.includes('taurus')) return 'https://logo.clearbit.com/taurusmutualfund.com';
  if (amc.includes('navi')) return 'https://logo.clearbit.com/navi.com';
  if (amc.includes('groww')) return 'https://logo.clearbit.com/groww.in';
  
  return ''; // fallback to initials
}

const formatNum = (num: number | string) => {
  return Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function MutualFundsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { mutualFunds: rawMfs, accounts, mutualFundTrades: trades, profile }, isValidating, mutate } = useFinanceData(initialData);
  const isMobile = useMediaQuery('(max-width: 767px)');
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

  const mfs = mutualFunds;
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, withLock] = useSubmitLock();
  const [activeTab, setActiveTab] = useState<"holdings" | "history">("holdings");

  
  // Search state
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

  // Initialize default account when accounts/profile loads or modal is opened
  useEffect(() => {
    if (accounts.length > 0 && showAddModal && !formData.account_id) {
      const defaultAccId = profile?.settings?.default_accounts?.mutual_funds;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      if (defaultAccExists) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, account_id: defaultAccId }));
        }, 0);
      }
    }
  }, [accounts, profile, showAddModal, formData.account_id]);

  const finalStampDuty = parseFloat(charges) || 0;

  const totalDeduction = useMemo(() => {
    const amount = parseFloat(formData.units || "0") * parseFloat(formData.nav || "0");
    return formData.trade_type === 'buy' ? amount + finalStampDuty : amount - finalStampDuty;
  }, [formData.units, formData.nav, finalStampDuty, formData.trade_type]);

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



  async function handleRevert(logId: string | null) {
    if (!logId) return toast.error("No ledger log found for this trade");
    if (!confirm("Revert this fund transaction? This will undo the portfolio change and reverse any account transactions.")) return;
    const res = await revertLedgerLog(logId);
    if (!res.error) {
      toast.success("Transaction reverted");
      mutate();
    } else toast.error(res.error);
  }

  // Export MF holdings to CSV
  function exportHoldings() {
    const csvData = mfs.map(mf => {
      const investment = Number(mf.units) * Number(mf.avg_nav);
      const currentVal = Number(mf.units) * Number(mf.current_nav);
      const pnl = currentVal - investment;
      const pnlPercent = investment > 0 ? (pnl / investment) * 100 : 0;
      return {
        fundName: mf.fund_name,
        amc: mf.amc_name || '',
        category: mf.category || '',
        type: mf.investment_type || '',
        units: Number(mf.units).toFixed(3),
        avgNav: Number(mf.avg_nav).toFixed(4),
        currentNav: Number(mf.current_nav).toFixed(4),
        invested: investment.toFixed(2),
        currentValue: currentVal.toFixed(2),
        pnl: pnl.toFixed(2),
        pnlPercent: pnlPercent.toFixed(2)
      };
    });
    
    exportToCSV(
      csvData,
      "mutual_funds",
      [
        { key: "fundName", label: "Fund Name" },
        { key: "amc", label: "AMC" },
        { key: "category", label: "Category" },
        { key: "type", label: "Type" },
        { key: "units", label: "Units" },
        { key: "avgNav", label: "Avg NAV" },
        { key: "currentNav", label: "Current NAV" },
        { key: "invested", label: "Invested" },
        { key: "currentValue", label: "Current Value" },
        { key: "pnl", label: "P&L" },
        { key: "pnlPercent", label: "P&L %" }
      ]
    );
    toast.success('Mutual funds exported successfully');
  }


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
            setFormData({ 
              fund_name: "", scheme_code: "", units: "", nav: "", current_nav: "",
              investment_type: "SIP", category: "Equity", amc_name: "HDFC",
              date: new Date().toISOString().split("T")[0], account_id: "",
              trade_type: "buy"
            });
            setCharges("0");
            mutate();
          } else {
            toast.error(res.error);
          }
        } else {
          if (!formData.account_id) {
              toast.error("Please select a channeling account");
              return;
          }
          const res = await recordMFInvestment({
            ...formData,
            units: parseFloat(formData.units),
            nav: parseFloat(formData.nav),
            stamp_duty: finalStampDuty,
            trade_type: formData.trade_type
          });
          if (!res?.error) {
            toast.success(formData.trade_type === 'buy' ? "Wealth deployed into mutual fund" : "Mutual fund units liquidated successfully");
            setShowAddModal(false);
            setFormData({ 
              fund_name: "", scheme_code: "", units: "", nav: "", current_nav: "",
              investment_type: "SIP", category: "Equity", amc_name: "HDFC",
              date: new Date().toISOString().split("T")[0], account_id: "",
              trade_type: "buy"
            });
            setCharges("0");
            mutate();
          } else {
            toast.error(res.error);
          }
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to process mutual fund investment. Please try again.");
      }
    });
  }


  if (isMobile) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in pb-[calc(var(--mobile-bottom-nav-height)+2rem)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[--text-primary]">Record Mutual Fund</h1>
            <div className={`status-dot scale-70 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400'}`} />
          </div>
          <Link href="/dashboard" className="text-[10px] font-black uppercase text-[--text-muted] no-underline bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg active:scale-95 transition-all">
            Back
          </Link>
        </div>

        <div className="flex bg-white/5 rounded-xl p-1 border border-white/5">
          <button 
            type="button"
            onClick={() => setFormData({ ...formData, trade_type: "buy" })}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              formData.trade_type === "buy" ? "bg-[--accent-primary] text-white shadow-md" : "text-[--text-muted]"
            }`}
          >
            Subscription (Buy)
          </button>
          <button 
            type="button"
            onClick={() => setFormData({ ...formData, trade_type: "sell" })}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
              formData.trade_type === "sell" ? "bg-rose-500 text-white shadow-md" : "text-[--text-muted]"
            }`}
          >
            Redemption (Sell)
          </button>
        </div>

        <div className="glass-card-static p-5 border border-white/5 bg-white/[0.01]">
          <form onSubmit={handleAddMF} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Fund Name</label>
              <input type="text" required className="input-premium" placeholder="e.g. Parag Parikh Flexi Cap Fund" value={formData.fund_name} onChange={e => setFormData({ ...formData, fund_name: e.target.value })} autoComplete="off" id="mf-name" name="fund_name" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Scheme Code</label>
                <input type="text" required className="input-premium" placeholder="e.g. 119598" value={formData.scheme_code} onChange={e => setFormData({ ...formData, scheme_code: e.target.value })} autoComplete="off" id="mf-scheme" name="scheme_code" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">AMC Name</label>
                <input type="text" required className="input-premium" placeholder="e.g. PPFAS" value={formData.amc_name} onChange={e => setFormData({ ...formData, amc_name: e.target.value })} autoComplete="off" id="mf-amc" name="amc_name" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Units</label>
                <input type="number" required step="any" className="input-premium" placeholder="0.000" value={formData.units} onChange={e => setFormData({ ...formData, units: e.target.value })} autoComplete="off" inputMode="decimal" id="mf-units" name="units" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">NAV (Price)</label>
                <input type="number" required step="any" className="input-premium" placeholder="0.00" value={formData.nav} onChange={e => setFormData({ ...formData, nav: e.target.value })} autoComplete="off" inputMode="decimal" id="mf-nav" name="nav" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Type</label>
                <select className="input-premium" value={formData.investment_type} onChange={e => setFormData({ ...formData, investment_type: e.target.value })} aria-label="Select investment type" id="mf-type" name="investment_type">
                  <option value="SIP">SIP</option>
                  <option value="Lumpsum">Lumpsum</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Category</label>
                <select className="input-premium" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} aria-label="Select mf category" id="mf-category" name="category">
                  <option value="Equity">Equity</option>
                  <option value="Debt">Debt</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Liquid">Liquid</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Transaction Date</label>
              <input type="date" required className="input-premium" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} autoComplete="off" id="mf-date" name="date" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
                {formData.trade_type === 'buy' ? 'Deduct From Account' : 'Deposit To Account'}
              </label>
              <select className="input-premium" value={formData.account_id} onChange={e => setFormData({ ...formData, account_id: e.target.value })} aria-label="Select account" id="mf-account" name="account_id">
                <option value="">No Deduction (Track only)</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
              </select>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full h-12 shadow-md mt-6">
              {submitting ? "Processing..." : "Confirm Record"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      
      {/* Portfolio Overview */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Mutual Funds</h1>
            <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.2em] mt-1">Manual NAV Tracking Console</p>
          </div>
          <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
        </div>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto">
            <button type="button" 
              onClick={exportHoldings} 
              className="btn-secondary !h-11 !px-6 flex items-center justify-center gap-2 hidden md:flex"
              title="Export Holdings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            <button type="button" 
              onClick={() => { setEditingId(null); setFormData(prev => ({ ...prev, trade_type: 'buy' })); setCharges("0"); setShowAddModal(true); }} 
              className="btn-primary !h-12 md:!h-11 !px-8 w-full md:w-auto text-[13px] md:text-[11px] font-black uppercase tracking-widest shadow-[0_4px_20px_rgba(var(--accent-primary-rgb),0.3)] order-first md:order-last"
            >
                Record Investment
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
        <div className="glass-card-static p-6 flex flex-col gap-2">
            <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Invested Capital</span>
            <span className="text-xl md:text-2xl font-black tabular-nums">+₹{stats.totalInvested.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
            <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Current Value</span>
            <span className="text-xl md:text-2xl font-black tabular-nums text-success">+₹{stats.totalCurrentValue.toLocaleString()}</span>
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
            <span className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Total P&L</span>
            <PnLValue value={stats.totalPnL} percentage={stats.totalPnLPercent} size="lg" className="items-start" />
        </div>
        <div className="glass-card-static p-6 flex flex-col gap-2">
            <span className="text-[10px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Avg. Return</span>
            <PnLValue value={stats.totalPnLPercent} prefix="" suffix="%" size="lg" className="items-start" />
        </div>
      </div>

      <div className="mx-4 flex items-center gap-1 bg-white/5 p-1 rounded-xl w-fit">
        <button type="button"
          onClick={() => setActiveTab("holdings")}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "holdings" ? "bg-[--accent-primary] text-white shadow-lg shadow-[--accent-primary]/20" : "text-[--text-muted] hover:text-[--text-primary]"}`}
        >
          Holdings ({mfs.length})
        </button>
        <button type="button"
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "history" ? "bg-success text-white shadow-lg shadow-[--success]/20" : "text-[--text-muted] hover:text-[--text-primary]"}`}
        >
          History ({trades.length})
        </button>
      </div>      {activeTab === "holdings" ? (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block mx-4 border border-white/5 rounded-2xl overflow-x-auto custom-scrollbar bg-white/[0.01]">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest">Growth Scheme</th>
                  <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Volume</th>
                  <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Avg NAV</th>
                  <th className="px-6 py-4 text-[9px] font-black text-[--text-muted] uppercase tracking-widest text-right">Live NAV</th>
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
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/20 p-0.5 shadow-md relative">
                                      {getAMCLogoUrl(mf.amc_name || '') ? (
                                        <Image 
                                          src={getAMCLogoUrl(mf.amc_name || '')} 
                                          alt={`${mf.amc_name || 'AMC'} logo`} 
                                          fill
                                          className="object-contain rounded-full p-1"
                                          sizes="40px"
                                        />
                                      ) : (
                                        <span className="text-[15px] font-black text-slate-800">
                                          {mf.amc_name ? mf.amc_name.substring(0, 1).toUpperCase() : 'M'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-[14px] text-[#eee] group-hover:text-[--accent-primary-light] transition-colors">{mf.fund_name}</span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button type="button" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toast(`Total Charges: ₹${(Number(mf.units) * Number(mf.avg_nav) * 0.00005).toFixed(4)} (Stamp Duty)`, {
                                                            icon: '👁️',
                                                            style: { background: '#1a1a1a', color: '#eee', border: '1px solid #333', fontSize: '11px', fontWeight: 'bold' }
                                                        });
                                                    }}
                                                    className="p-1.5 hover:bg-white/10 rounded-lg text-[--text-muted] hover:text-[--accent-primary-light] transition-all"
                                                    title="View charges"
                                                 >
                                                     <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                                         <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.644C3.399 8.32 7.31 5 12 5c4.69 0 8.601 3.32 9.964 6.678a1.012 1.012 0 010 .644C19.601 15.68 15.69 19 12 19c-4.69 0-8.601-3.32-9.964-6.678z" />
                                                         <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                     </svg>
                                                 </button>
                                                <button type="button" 
                                                    onClick={(e) => { e.stopPropagation(); startEdit(mf); }}
                                                    className="px-2 py-0.5 bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-white text-[9px] font-black uppercase rounded transition-all"
                                                >
                                                    Edit
                                                </button>
                                                <button type="button" 
                                                    onClick={(e) => { e.stopPropagation(); startSell(mf); }}
                                                    className="px-2 py-0.5 bg-danger/10 hover:bg-danger text-danger hover:text-white text-[9px] font-black uppercase rounded transition-all"
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
                                <PnLValue value={pnl} percentage={pnlPercent} size="md" />
                            </td>
                         </tr>
                     );
                 })}
               </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-4 px-4">
            {mfs.length === 0 ? (
              <div className="p-8 text-center text-[#666] italic text-sm">No holdings recorded yet.</div>
            ) : mfs.map((mf) => {
              const investment = Number(mf.units) * Number(mf.avg_nav);
              const currentVal = Number(mf.units) * Number(mf.current_nav);
              const pnl = currentVal - investment;
              const pnlPercent = investment > 0 ? (pnl / investment) * 100 : 0;
              const isProfit = pnl >= 0;
              
              return (
                <div key={mf.id} className="glass-card-static p-5 active:bg-white/[0.04] transition-all relative overflow-hidden">
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/20 p-0.5 relative">
                        {getAMCLogoUrl(mf.amc_name || '') ? (
                          <Image 
                            src={getAMCLogoUrl(mf.amc_name || '')} 
                            alt="logo" 
                            fill
                            className="object-contain rounded-full p-1"
                            sizes="40px"
                          />
                        ) : (
                          <span className="text-[15px] font-black text-slate-800">
                            {mf.amc_name ? mf.amc_name.substring(0, 1).toUpperCase() : 'M'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white leading-tight">{mf.fund_name}</span>
                        <span className="text-[9px] text-[--text-muted] font-bold uppercase tracking-wider mt-1">
                          {mf.category} • {mf.investment_type}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className={`text-[15px] font-black ${isProfit ? 'text-success' : 'text-danger'}`}>
                        {isProfit ? '+' : ''}₹{formatNum(pnl)}
                      </span>
                      <span className={`text-[10px] font-bold opacity-60 ${isProfit ? 'text-success' : 'text-danger'}`}>
                        {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 border-t border-white/5 pt-3 mb-4 text-[12px]">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Holding Units</p>
                      <p className="font-bold text-white">{Number(mf.units).toFixed(3)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Avg NAV</p>
                      <p className="font-bold text-[#eee]">₹{Number(mf.avg_nav).toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Current Live NAV</p>
                      <p className="font-bold text-white">₹{Number(mf.current_nav).toFixed(3)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[--text-muted] mb-0.5">Current Value</p>
                      <p className="font-bold text-[--accent-primary-light]">₹{formatNum(currentVal)}</p>
                    </div>
                    <div className="col-span-2 border-t border-white/5 pt-3 mt-1 flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[--text-muted]">Invested Capital</span>
                      <span className="font-medium text-[--text-secondary]">₹{formatNum(investment)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button type="button" 
                      onClick={() => { 
                        setEditingId(null); 
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
                        setShowAddModal(true); 
                      }} 
                      className="flex-1 py-2.5 bg-success/15 hover:bg-success/25 text-success border border-success/20 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      Buy More
                    </button>
                    <button type="button" 
                      onClick={() => startSell(mf)} 
                      className="flex-1 py-2.5 bg-danger/15 hover:bg-danger/25 text-danger border border-danger/20 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      Redeem
                    </button>
                    <button type="button" 
                      onClick={() => startEdit(mf)} 
                      className="w-12 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Desktop History Table View */}
          <div className="hidden md:block mx-4 border border-white/5 rounded-2xl overflow-x-auto custom-scrollbar bg-white/[0.01]">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-[9px] text-[--text-muted] uppercase font-black tracking-widest">
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Scheme</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4 text-right">Units</th>
                  <th className="px-6 py-4 text-right">NAV</th>
                  <th className="px-6 py-4 text-right">Amount Delta</th>
                  <th className="px-6 py-4 text-right">Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {trades.length === 0 ? (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-[#666] italic text-sm">No transaction history recorded yet.</td></tr>
                ) : trades.map((trade) => {
                  const isBuy = trade.trade_type?.toLowerCase() === 'buy';
                  return (
                    <tr key={trade.id} className="hover:bg-white/[0.01] transition-colors group">
                      <td className="px-6 py-4 text-[11px] font-bold text-[--text-muted] tabular-nums">{trade.date}</td>
                      <td className="px-6 py-4"><span className="text-[13px] font-bold text-[#eee]">{trade.fund_name}</span></td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${isBuy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {trade.trade_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium tabular-nums text-[#eee] text-[13px]">{Number(trade.units).toFixed(3)}</td>
                      <td className="px-6 py-4 text-right font-medium tabular-nums text-[#666] text-[13px]">₹{Number(trade.nav).toFixed(3)}</td>
                      <td className="px-6 py-4 text-right font-black tabular-nums text-[13px]">
                         <span className={isBuy ? 'text-rose-400' : 'text-emerald-400'}>
                           {isBuy ? '-' : '+'}₹{Number(trade.amount).toLocaleString()}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <button type="button" 
                           onClick={() => handleRevert(trade.ledger_log_id)}
                           disabled={submitting}
                           className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all bg-rose-500/5 px-3 py-1 rounded-lg border border-rose-500/10"
                         >
                           Revert
                         </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile History Cards View */}
          <div className="md:hidden space-y-4 px-4">
            {trades.length === 0 ? (
              <div className="p-8 text-center text-[#666] italic text-sm">No transaction history recorded yet.</div>
            ) : trades.map((trade) => {
              const isBuy = trade.trade_type?.toLowerCase() === 'buy';
              return (
                <div key={trade.id} className="glass-card-static p-4 border-white/5">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-bold text-[--text-muted]">{trade.date}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${isBuy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                      {trade.trade_type}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-white mb-3">{trade.fund_name}</p>
                  <div className="grid grid-cols-2 gap-y-2 text-[12px] border-t border-white/5 pt-3 mb-3">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-[--text-muted]">Units</p>
                      <p className="font-bold text-white">{Number(trade.units).toFixed(3)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-wider text-[--text-muted]">NAV</p>
                      <p className="font-bold text-white">₹{Number(trade.nav).toFixed(3)}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#666]">Amount Delta</span>
                    <span className={`font-black text-sm ${isBuy ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {isBuy ? '-' : '+'}₹{Number(trade.amount).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button type="button" 
                      onClick={() => handleRevert(trade.ledger_log_id)}
                      disabled={submitting}
                      className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl border border-rose-500/10 transition-all"
                    >
                      Revert Order
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Record Investment Modal */}
      {showAddModal && (
        <div className="mobile-dialog-shell fixed inset-0 z-[200] overflow-y-auto custom-scrollbar bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in px-4">
          <div className="flex min-h-full items-center justify-center p-4 py-12">
            <div className="mobile-dialog-panel glass-card-static w-full max-w-3xl p-8 md:p-12 rounded-3xl">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-3xl font-black tracking-tight">{editingId ? 'Edit Mutual Fund Holding' : formData.trade_type === 'buy' ? 'Investment Log' : 'Asset Redemption'}</h2>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-[--text-muted] hover:text-[--text-primary] transition-colors p-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddMF} className="space-y-6">
              
              {/* Scheme Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Fund Name</label>
                  <input
                    required
                    className="input-premium h-12"
                    placeholder="e.g. Axis Bluechip Fund"
                    value={formData.fund_name}
                    onChange={e => setFormData({ ...formData, fund_name: e.target.value })}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">AMC Name</label>
                  <input
                    required
                    className="input-premium h-12"
                    placeholder="e.g. Axis Mutual Fund"
                    value={formData.amc_name}
                    onChange={e => setFormData({ ...formData, amc_name: e.target.value })}
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Scheme Code / Symbol</label>
                  <input
                    required
                    className="input-premium h-12"
                    placeholder="e.g. INF846K01DP8"
                    value={formData.scheme_code}
                    onChange={e => setFormData({ ...formData, scheme_code: e.target.value })}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Allocated Units</label>
                  <input required type="number" step="0.001" className="input-premium h-12" placeholder="0.000" value={formData.units} onChange={e => setFormData({...formData, units: e.target.value})} autoComplete="new-password" inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Avg. Buy Price (NAV)</label>
                  <input required type="number" step="0.0001" className="input-premium h-12" placeholder="0.0000" value={formData.nav} onChange={e => setFormData({...formData, nav: e.target.value})} autoComplete="new-password" inputMode="decimal" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Current NAV (Live)</label>
                  <input required type="number" step="0.0001" className="input-premium h-12" placeholder="0.0000" value={formData.current_nav} onChange={e => setFormData({...formData, current_nav: e.target.value})} autoComplete="new-password" inputMode="decimal" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Investment Model</label>
                  <select aria-label="Select investment type" id="mf-investment-type" name="investment_type" className="input-premium h-12" value={formData.investment_type} onChange={e => setFormData({...formData, investment_type: e.target.value})}>
                    <option value="SIP">SIP Engine</option>
                    <option value="LUMPSUM">One-Time Capital</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Asset Sector</label>
                  <select aria-label="Select fund category" id="mf-category" name="category" className="input-premium h-12" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {["Equity", "Debt", "Hybrid", "Index", "Liquid", "ELSS"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Trade Date</label>
                  <input type="date" className="input-premium h-12" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} autoComplete="new-password" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {!editingId ? (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">{formData.trade_type === 'buy' ? 'Capital Source' : 'Deposit To'}</label>
                    <select aria-label="Select account" id="mf-account" name="account_id" required={!editingId} className="input-premium h-12" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                        <option value="">{formData.trade_type === 'buy' ? 'Fund Account' : 'Dest. Account'}</option>
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>)}
                    </select>
                    {formData.account_id && (() => {
                      const selectedAcc = accounts.find(a => a.id === formData.account_id);
                      return selectedAcc ? (
                        <div className="mt-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-[--text-secondary] animate-fade-in">
                          <span className="font-medium">Selected Balance</span>
                          <span className="font-bold text-white">
                            {selectedAcc.currency === 'USD' ? '$' : '₹'}{selectedAcc.balance.toLocaleString()}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-[#666] ml-1">Stamp Duty / Charges (₹)</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="input-premium h-12"
                    placeholder="0.0000"
                    value={charges}
                    onChange={e => setCharges(e.target.value)}
                    autoComplete="new-password"
                    inputMode="decimal"
                  />
                </div>
              </div>

              {/* Charge Summary Box */}
              {!editingId ? (
                <div className="bg-[--bg-surface] border border-[--border-strong] rounded-2xl p-5 space-y-4 shadow-lg animate-fade-in">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-[--text-muted] uppercase tracking-widest">{formData.trade_type === 'buy' ? 'Net Payable' : 'Net Receivable'}</span>
                    <span className="text-base font-black text-[--accent-primary-light]">₹{totalDeduction.toLocaleString()}</span>
                  </div>
                </div>
              ) : null}

              <button type="submit" disabled={submitting} className="btn-primary w-full shadow-2xl mt-4">
                 {editingId ? "Update Mutual Fund Holding" : submitting ? (formData.trade_type === 'buy' ? "Deploying Capital..." : "Liquidating...") : (formData.trade_type === 'buy' ? "Authorize Investment" : "Authorize Redemption")}
              </button>
            </form>
          </div>
          </div>
        </div>
      )}

    </div>
  );
}
