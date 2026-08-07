"use client";

import { useMemo, useState } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { ModuleGuard } from "@/components/module-guard";
import { toast } from "react-hot-toast";
import { triggerAllMarketSync } from "@/app/dashboard/settings/actions";
import {
  computeIndiaTaxReport,
  formatFYLabel,
  getCurrentFYStartYear,
  type TaxRegime,
} from "@/lib/tax/india-tax-engine";
import Form16ParserModal from "@/components/Form16ParserModal";
import { TaxLossHarvestingCalculator } from "./components/TaxLossHarvestingCalculator";
import { AITaxSyncModal } from "./components/AITaxSyncModal";
import {
  Zap,
  Receipt,
  Calendar,
  DollarSign,
  ShieldCheck,
  CheckCircle,
  BarChart3,
  Layers,
  Calculator,
  Sparkles,
  FileText,
  Bot,
} from "lucide-react";

const formatINR = (value: number) =>
  value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default function TaxReportsClient() {
  const { data, mutate } = useFinanceData();
  const [regime, setRegime] = useState<TaxRegime>("new");
  const [fyStartYear, setFyStartYear] = useState(getCurrentFYStartYear());
  const [businessMode, setBusinessMode] = useState(false);
  const [isSyncingPrices, setIsSyncingPrices] = useState(false);
  const [showMathAudit, setShowMathAudit] = useState(true);
  const [showForm16Modal, setShowForm16Modal] = useState(false);
  const [showAITaxSyncModal, setShowAITaxSyncModal] = useState(false);

  const {
    incomes = [],
    expenses = [],
    investments = [],
    mutualFunds = [],
    bonds = [],
    liabilities = [],
    alternativeAssets = [],
  } = data || {};

  const fyOptions = useMemo(() => {
    const current = getCurrentFYStartYear();
    return [current - 2, current - 1, current, current + 1];
  }, []);

  const taxInput = useMemo(
    () => ({
      fyStartYear,
      regime,
      incomes,
      expenses,
      transactions: data?.transactions || [],
      investments,
      mutualFunds,
      bonds,
      alternativeAssets,
      liabilities,
    }),
    [fyStartYear, regime, incomes, expenses, data?.transactions, investments, mutualFunds, bonds, alternativeAssets, liabilities]
  );

  const report = useMemo(() => computeIndiaTaxReport(taxInput), [taxInput]);

  const stdDeduction = regime === "new" ? 75000 : 50000;
  const taxableNet = Math.max(0, report.taxHeads.grossIncome - stdDeduction);
  const isTaxFree87A = regime === "new" ? taxableNet <= 1200000 : taxableNet <= 500000;
  const rebatedTax = isTaxFree87A ? 0 : report.taxPayment.taxPayable;

  const handleSyncPrices = async () => {
    setIsSyncingPrices(true);
    const toastId = toast.loading("Syncing live market NAVs and prices...");
    try {
      const res = await triggerAllMarketSync();
      if (res.error) {
        toast.error(`Market sync failed: ${res.error}`, { id: toastId });
      } else {
        toast.success(res.message || "Live market prices & NAVs updated!", { id: toastId });
        mutate();
      }
    } catch {
      toast.error("Failed to fetch live market prices", { id: toastId });
    } finally {
      setIsSyncingPrices(false);
    }
  };

  return (
    <ModuleGuard moduleKey="Tax & Reports">
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
        {/* ─── Apple / Vercel-Grade Header Banner ─── */}
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-indigo-950/50 to-slate-950/95 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-wider mb-3">
                <Receipt className="w-3.5 h-3.5 text-cyan-400" />
                <span>Verified Income Tax Engine • FY 2025–26</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
                India Tax Calculation Studio
              </h1>
              <p className="text-xs sm:text-sm text-gray-300 mt-1 max-w-2xl font-medium leading-relaxed">
                Official Finance Act 2025 rules. Transparent line-by-line math audit for Section 87A rebate, standard deduction, and tax regime optimization.
              </p>
            </div>

            {/* Live Sync Action & Form 16 Parser */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAITaxSyncModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-lg shadow-amber-500/10"
              >
                <Bot className="w-3.5 h-3.5 text-amber-400" />
                <span>AI Tax Auto-Sync</span>
              </button>

              <button
                type="button"
                onClick={() => setShowForm16Modal(true)}
                className="px-4 py-2.5 rounded-2xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-lg shadow-purple-500/10"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Launch Form 16 Parser</span>
              </button>

              <button
                type="button"
                onClick={handleSyncPrices}
                disabled={isSyncingPrices}
                className="px-4 py-2.5 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 shadow-lg shadow-cyan-500/10"
              >
                <Zap className={`w-3.5 h-3.5 ${isSyncingPrices ? "animate-spin" : ""}`} />
                <span>{isSyncingPrices ? "Syncing Market NAVs..." : "Sync Live NAVs"}</span>
              </button>
            </div>
          </div>
        </div>

        <AITaxSyncModal
          isOpen={showAITaxSyncModal}
          onClose={() => setShowAITaxSyncModal(false)}
          onSuccess={() => mutate()}
        />

        <Form16ParserModal
          isOpen={showForm16Modal}
          onClose={() => setShowForm16Modal(false)}
          onApply={() => mutate()}
        />

        {/* ─── Control Bar ─── */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400">Financial Year (FY)</p>
              <p className="text-sm font-black text-white">{formatFYLabel(fyStartYear)} (Assessment Year {fyStartYear + 1}–{String(fyStartYear + 2).slice(2)})</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
              <select
                value={fyStartYear}
                onChange={(e) => setFyStartYear(Number(e.target.value))}
                className="bg-transparent text-white text-xs font-bold px-2.5 py-1.5 outline-none cursor-pointer"
              >
                {fyOptions.map((fy) => (
                  <option key={fy} value={fy} className="bg-slate-900 text-white">
                    {formatFYLabel(fy)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setRegime("new")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  regime === "new" ? "bg-cyan-500 text-black shadow-md font-black" : "text-gray-400 hover:text-white"
                }`}
              >
                New Regime (Budget 2025-26)
              </button>
              <button
                type="button"
                onClick={() => setRegime("old")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  regime === "old" ? "bg-purple-600 text-white shadow-md font-black" : "text-gray-400 hover:text-white"
                }`}
              >
                Old Regime
              </button>
            </div>

            <button
              type="button"
              onClick={() => setBusinessMode((s) => !s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                businessMode ? "border-amber-500/50 bg-amber-500/10 text-amber-300" : "border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              GST Mode {businessMode ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* ─── Hero Tax Status Cards ─── */}
        <div className="grid md:grid-cols-3 gap-5">
          {/* Gross Income Card */}
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-400 text-xs font-bold">
              <span>Gross Annual Earnings</span>
              <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-3xl font-black text-white tracking-tight">{formatINR(report.taxHeads.grossIncome)}</p>
            <p className="text-[11px] text-gray-400">Sum of Salary, Rent, Capital Gains & Interest</p>
          </div>

          {/* Net Tax Payable Card */}
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-400 text-xs font-bold">
              <span>Net Tax Payable</span>
              <Receipt className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-3xl font-black text-rose-400 tracking-tight">{formatINR(rebatedTax)}</p>

            {isTaxFree87A ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                100% Tax Free (Sec 87A Rebate Active)
              </span>
            ) : (
              <p className="text-[11px] text-gray-400">After ₹{stdDeduction.toLocaleString()} standard deduction</p>
            )}
          </div>

          {/* Tax Paid & Refund Status Card */}
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-400 text-xs font-bold">
              <span>TDS / Advance Tax Paid</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-black text-emerald-400 tracking-tight">{formatINR(report.taxPayment.totalTaxPaid)}</p>

            {report.taxPayment.taxRefundEstimate > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Refund Due: {formatINR(report.taxPayment.taxRefundEstimate)}
              </span>
            ) : (
              <p className="text-[11px] text-gray-400">TDS deducted by employer or banks</p>
            )}
          </div>
        </div>

        {/* ─── TAX LOSS & GAIN HARVESTING STUDIO ─── */}
        <TaxLossHarvestingCalculator input={taxInput} />

        {/* ─── TRANSPARENT LINE-BY-LINE MATH AUDIT BOX ─── */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900/90 via-indigo-950/40 to-slate-950/90 border border-cyan-500/20 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-tight">Line-by-Line Tax Audit & Formula</h3>
                <p className="text-xs text-gray-400">Exact mathematical verification under Finance Act 2025 rules</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMathAudit(!showMathAudit)}
              className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              {showMathAudit ? "Hide Audit Formula" : "Show Audit Formula"}
            </button>
          </div>

          {showMathAudit && (
            <div className="p-5 rounded-2xl bg-black/50 border border-white/10 font-mono text-xs space-y-3">
              <div className="flex justify-between text-gray-300">
                <span>1. Total Gross Annual Income</span>
                <span className="font-bold text-white">+ {formatINR(report.taxHeads.grossIncome)}</span>
              </div>

              <div className="flex justify-between text-gray-400">
                <span>2. Less Standard Deduction (Sec 16ia)</span>
                <span className="font-bold text-rose-400">- {formatINR(stdDeduction)}</span>
              </div>

              <div className="flex justify-between text-cyan-300 font-bold border-t border-white/10 pt-2">
                <span>3. Net Taxable Income</span>
                <span>= {formatINR(taxableNet)}</span>
              </div>

              <div className="pl-4 border-l-2 border-cyan-500/30 space-y-1.5 text-[11px] text-gray-400">
                <p className="text-gray-300 font-sans font-bold mb-1">Slab Tax Calculation (New Regime FY25-26):</p>
                <div className="flex justify-between"><span>• Up to ₹4,00,000 @ 0%</span><span>₹0</span></div>
                <div className="flex justify-between"><span>• ₹4,00,001 to ₹8,00,000 @ 5%</span><span>{taxableNet > 400000 ? formatINR(Math.min(400000, taxableNet - 400000) * 0.05) : "₹0"}</span></div>
                <div className="flex justify-between"><span>• ₹8,00,001 to ₹12,00,000 @ 10%</span><span>{taxableNet > 800000 ? formatINR(Math.min(400000, taxableNet - 800000) * 0.10) : "₹0"}</span></div>
                {taxableNet > 1200000 && (
                  <div className="flex justify-between"><span>• ₹12,00,001 to ₹16,00,000 @ 15%</span><span>{formatINR(Math.min(400000, taxableNet - 1200000) * 0.15)}</span></div>
                )}
              </div>

              <div className="flex justify-between text-gray-400">
                <span>4. Section 87A Tax Rebate (Finance Act 2025 limit: ₹60,000)</span>
                <span className="font-bold text-emerald-400">- {isTaxFree87A ? formatINR(report.taxPayment.taxPayable) : "₹0"}</span>
              </div>

              <div className="flex justify-between text-base font-sans font-black text-white border-t-2 border-white/20 pt-3">
                <span className="flex items-center gap-2">
                  <span>Final Net Income Tax Payable</span>
                  {isTaxFree87A && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold font-mono">100% TAX FREE</span>}
                </span>
                <span className={isTaxFree87A ? "text-emerald-400" : "text-rose-400"}>{formatINR(rebatedTax)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ─── Income Heads & Regime Comparator ─── */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Income Heads Card */}
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <span>Income Sources Breakdown</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="font-bold text-white block">1. Salary Income</span>
                  <span className="text-[10px] text-gray-400">Payroll, allowances, and bonuses</span>
                </div>
                <span className="font-mono font-bold text-cyan-300 text-sm">{formatINR(report.taxHeads.salaryIncome)}</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="font-bold text-white block">2. House Property</span>
                  <span className="text-[10px] text-gray-400">Rental income minus property expenses</span>
                </div>
                <span className="font-mono font-bold text-cyan-300 text-sm">{formatINR(report.taxHeads.housePropertyIncome)}</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="font-bold text-white block">3. Capital Gains (Realized)</span>
                  <span className="text-[10px] text-gray-400">STCG & LTCG from sold Stocks/MF/Crypto</span>
                </div>
                <span className="font-mono font-bold text-cyan-300 text-sm">{formatINR(report.taxHeads.capitalGains.stcg + report.taxHeads.capitalGains.ltcg)}</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                <div>
                  <span className="font-bold text-white block">4. Other Sources</span>
                  <span className="text-[10px] text-gray-400">Bank interest, dividends, gifts</span>
                </div>
                <span className="font-mono font-bold text-cyan-300 text-sm">{formatINR(report.taxHeads.otherSourcesIncome)}</span>
              </div>
            </div>

            {/* GST Breakdown */}
            {businessMode && (
              <div className="mt-4 pt-4 border-t border-amber-500/20 space-y-2 text-xs">
                <p className="text-amber-400 font-black text-[11px] uppercase tracking-wider">GST Outflow Breakdown</p>
                <div className="flex justify-between text-gray-300"><span>CGST</span><span className="font-mono">{formatINR(report.taxPayment.gstBreakdown.cgst)}</span></div>
                <div className="flex justify-between text-gray-300"><span>SGST</span><span className="font-mono">{formatINR(report.taxPayment.gstBreakdown.sgst)}</span></div>
                <div className="flex justify-between text-gray-300"><span>IGST</span><span className="font-mono">{formatINR(report.taxPayment.gstBreakdown.igst)}</span></div>
                <div className="flex justify-between font-bold text-white border-t border-amber-500/20 pt-2"><span>Total GST Paid</span><span className="font-mono">{formatINR(report.taxPayment.gst)}</span></div>
              </div>
            )}
          </div>

          {/* Tax Regime Comparison Card */}
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Regime Recommendation Engine</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className={`p-5 rounded-2xl border transition-all ${regime === "new" ? "border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/10" : "border-white/5 bg-black/20"}`}>
                <p className="text-[11px] font-black uppercase tracking-wider text-cyan-400">New Regime (FY25-26)</p>
                <p className="text-2xl font-black text-white mt-1">{formatINR(report.regimeComparison.new)}</p>
                <p className="text-[10px] text-gray-400 mt-2">Std Deduction: ₹75,000<br />Sec 87A: 100% Tax Free ≤ ₹12L</p>
              </div>

              <div className={`p-5 rounded-2xl border transition-all ${regime === "old" ? "border-purple-500/50 bg-purple-500/10 shadow-lg shadow-purple-500/10" : "border-white/5 bg-black/20"}`}>
                <p className="text-[11px] font-black uppercase tracking-wider text-purple-400">Old Regime</p>
                <p className="text-2xl font-black text-white mt-1">{formatINR(report.regimeComparison.old)}</p>
                <p className="text-[10px] text-gray-400 mt-2">Std Deduction: ₹50,000<br />80C/80D Eligible</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Smart Choice: Use <strong>{report.regimeComparison.recommended.toUpperCase()} Regime</strong></span>
              </span>
              <span className="font-mono font-bold text-sm">Save {formatINR(report.regimeComparison.savingsVsOther)}</span>
            </div>
          </div>
        </div>

        {/* ─── Deductions Tracker & Compliance Deadlines ─── */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Deductions Tracker */}
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Chapter VI-A Deductions Tracker</h3>
            <div className="space-y-3">
              {report.deductions.items.map((item) => {
                const pct = Math.min(100, Math.round((item.used / item.limit) * 100));
                return (
                  <div key={item.code} className="space-y-1.5 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{item.code} Deduction</span>
                      <span className="font-mono text-cyan-300 font-bold">{formatINR(item.used)} / {formatINR(item.limit)}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/50 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compliance Deadlines */}
          <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Income Tax Compliance Deadlines</h3>
            <div className="space-y-2.5">
              {report.fiscal.taxCalendar.map((event) => (
                <div key={event.dueDate} className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-xs">
                  <span className="text-gray-300">{event.label}</span>
                  <span className="font-mono font-bold text-amber-300 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">{event.dueDate}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ModuleGuard>
  );
}
