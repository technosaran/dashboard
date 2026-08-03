"use client";

import { useState } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { exportToCSV } from "@/lib/export-csv";
import dynamic from "next/dynamic";
import {
  DollarSign,
  CreditCard,
  Landmark,
  BarChart2,
  TrendingUp,
  Gem,
  ScrollText,
  Home,
  RefreshCw,
  Rocket,
} from "lucide-react";

const ReportDownloadButton = dynamic(
  () => import("../../components/ReportDownloadButton"),
  { ssr: false }
);

export default function ExportsTab() {
  const { data } = useFinanceData();
  const [exportSearch, setExportSearch] = useState("");

  const {
    incomes = [],
    expenses = [],
    accounts = [],
    ledgerLogs = [],
    investments = [],
    mutualFunds = [],
    stockTrades = [],
    mutualFundTrades = [],
    bonds = [],
    liabilities = [],
    alternativeAssets = [],
    forexAccounts = [],
  } = data || {};

  const handleExportIncome = () => {
    exportToCSV(incomes, "income_entries", [
      { key: "date", label: "Date" },
      { key: "description", label: "Description / Source" },
      { key: "amount", label: "Amount" },
      { key: "category", label: "Category" },
    ]);
  };

  const handleExportExpenses = () => {
    exportToCSV(expenses, "expense_entries", [
      { key: "date", label: "Date" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Amount" },
      { key: "category", label: "Category" },
    ]);
  };

  const handleExportAccounts = () => {
    exportToCSV(accounts, "accounts_portfolio", [
      { key: "name", label: "Account Name" },
      { key: "bank_name", label: "Bank Institution" },
      { key: "type", label: "Account Type" },
      { key: "currency", label: "Currency" },
      { key: "balance", label: "Balance" },
    ]);
  };

  const handleExportLedger = () => {
    exportToCSV(ledgerLogs, "ledger_audit_trail", [
      { key: "created_at", label: "Date & Time" },
      { key: "action_type", label: "Action" },
      { key: "account_name", label: "Account" },
      { key: "amount", label: "Amount" },
      { key: "previous_balance", label: "Previous Balance" },
      { key: "new_balance", label: "New Balance" },
      { key: "details", label: "Details" },
    ]);
  };

  const handleExportStocks = () => {
    exportToCSV(investments, "stock_holdings", [
      { key: "symbol", label: "Symbol" },
      { key: "name", label: "Company Name" },
      { key: "quantity", label: "Quantity" },
      { key: "buy_price", label: "Avg Buy Price" },
      { key: "current_price", label: "Current Price" },
    ]);
  };

  const handleExportMutualFunds = () => {
    exportToCSV(mutualFunds, "mutual_funds_portfolio", [
      { key: "fund_name", label: "Fund Name" },
      { key: "amc_name", label: "AMC / House" },
      { key: "units", label: "Units Held" },
      { key: "avg_nav", label: "Avg NAV (Buy)" },
      { key: "current_nav", label: "Current NAV" },
    ]);
  };

  const handleExportBonds = () => {
    exportToCSV(bonds, "bonds_fixed_income", [
      { key: "bond_name", label: "Bond Name" },
      { key: "issuer", label: "Issuer" },
      { key: "face_value", label: "Face Value" },
      { key: "coupon_rate", label: "Coupon Rate (%)" },
      { key: "maturity_date", label: "Maturity Date" },
    ]);
  };

  const handleExportLiabilities = () => {
    exportToCSV(liabilities, "liabilities_loans", [
      { key: "name", label: "Liability / Loan Name" },
      { key: "category", label: "Category" },
      { key: "remaining_amount", label: "Outstanding Balance" },
      { key: "interest_rate", label: "Interest Rate (%)" },
      { key: "monthly_payment", label: "Monthly Payment" },
    ]);
  };

  const handleExportAlternativeAssets = () => {
    exportToCSV(alternativeAssets, "alternative_assets", [
      { key: "name", label: "Asset Name" },
      { key: "category", label: "Asset Category" },
      { key: "current_value", label: "Estimated Value" },
      { key: "notes", label: "Notes" },
    ]);
  };

  const handleExportForex = () => {
    exportToCSV(forexAccounts, "forex_accounts", [
      { key: "broker_name", label: "Broker" },
      { key: "account_label", label: "Account Label" },
      { key: "currency", label: "Currency" },
      { key: "balance", label: "Balance" },
    ]);
  };

  const handleExportStockTrades = () => {
    exportToCSV(stockTrades, "stock_trades_history", [
      { key: "symbol", label: "Symbol" },
      { key: "trade_type", label: "Type" },
      { key: "quantity", label: "Quantity" },
      { key: "price", label: "Price" },
      { key: "trade_date", label: "Date" },
    ]);
  };

  const handleExportMutualFundTrades = () => {
    exportToCSV(mutualFundTrades, "mutual_fund_trades_history", [
      { key: "fund_name", label: "Fund Name" },
      { key: "trade_type", label: "Type" },
      { key: "units", label: "Units" },
      { key: "nav", label: "NAV" },
      { key: "amount", label: "Amount" },
      { key: "date", label: "Date" },
    ]);
  };

  const exportCards: {
    title: string;
    desc: string;
    count: number;
    icon: React.ReactNode;
    action: () => void;
    badge: string;
    color: string;
  }[] = [
    {
      title: "Income Revenue Streams",
      desc: "Salary, dividends, freelance credits, and bonus history",
      count: incomes.length,
      icon: <DollarSign className="w-6 h-6 text-emerald-400" />,
      action: handleExportIncome,
      badge: "CSV",
      color: "emerald",
    },
    {
      title: "Expense Transactions",
      desc: "Categorized outflow transactions & spending history",
      count: expenses.length,
      icon: <CreditCard className="w-6 h-6 text-rose-400" />,
      action: handleExportExpenses,
      badge: "CSV",
      color: "rose",
    },
    {
      title: "Bank & Credit Accounts",
      desc: "Checking, savings, credit cards, and liquid balance nodes",
      count: accounts.length,
      icon: <Landmark className="w-6 h-6 text-sky-400" />,
      action: handleExportAccounts,
      badge: "CSV",
      color: "sky",
    },
    {
      title: "Ledger & Audit Trail",
      desc: "Full immutable log of all balance changes and transfers",
      count: ledgerLogs.length,
      icon: <BarChart2 className="w-6 h-6 text-amber-400" />,
      action: handleExportLedger,
      badge: "CSV",
      color: "amber",
    },
    {
      title: "Stock Holdings (Equities)",
      desc: "Direct stock portfolio, quantity, buy price, and current values",
      count: investments.length,
      icon: <TrendingUp className="w-6 h-6 text-cyan-400" />,
      action: handleExportStocks,
      badge: "CSV",
      color: "cyan",
    },
    {
      title: "Mutual Funds & SIPs",
      desc: "AMC schemes, units, invested capital, and latest NAVs",
      count: mutualFunds.length,
      icon: <Gem className="w-6 h-6 text-indigo-400" />,
      action: handleExportMutualFunds,
      badge: "CSV",
      color: "indigo",
    },
    {
      title: "Equity & Stock Trades",
      desc: "Executed stock trades, buy/sell executions, and P&L history",
      count: stockTrades.length,
      icon: <TrendingUp className="w-6 h-6 text-sky-400" />,
      action: handleExportStockTrades,
      badge: "CSV",
      color: "sky",
    },
    {
      title: "Mutual Fund Trades",
      desc: "SIP investments, lumpsum purchases, and redemption records",
      count: mutualFundTrades.length,
      icon: <Landmark className="w-6 h-6 text-indigo-400" />,
      action: handleExportMutualFundTrades,
      badge: "CSV",
      color: "indigo",
    },
    {
      title: "Bond Holdings & Fixed Income",
      desc: "Corporate bonds, sovereign gold bonds, and yield records",
      count: bonds.length,
      icon: <ScrollText className="w-6 h-6 text-purple-400" />,
      action: handleExportBonds,
      badge: "CSV",
      color: "purple",
    },
    {
      title: "Liabilities & Debt",
      desc: "Loans, EMIs, credit card dues, and outstanding debt balances",
      count: liabilities.length,
      icon: <CreditCard className="w-6 h-6 text-rose-400" />,
      action: handleExportLiabilities,
      badge: "CSV",
      color: "rose",
    },
    {
      title: "Alternative Assets",
      desc: "Real estate, precious metals, startup equity, and private assets",
      count: alternativeAssets.length,
      icon: <Home className="w-6 h-6 text-yellow-400" />,
      action: handleExportAlternativeAssets,
      badge: "CSV",
      color: "yellow",
    },
    {
      title: "Forex & USD Portfolio",
      desc: "Foreign currency accounts, balances, and invested capital",
      count: forexAccounts.length,
      icon: <RefreshCw className="w-6 h-6 text-orange-400" />,
      action: handleExportForex,
      badge: "CSV",
      color: "orange",
    },
  ];

  const q = exportSearch.toLowerCase().trim();
  const filteredCards = !q
    ? exportCards
    : exportCards.filter(
        (c) => c.title.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
      );

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner: Custom Statement & PDF/CSV Builder */}
      <div className="glass-card rich-border p-6 md:p-8 rounded-3xl relative overflow-hidden bg-gradient-to-br from-cyan-950/30 via-slate-900/60 to-purple-950/30 border border-cyan-500/20 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-black uppercase tracking-wider mb-3">
              <span className="flex items-center gap-1.5"><Rocket className="w-3.5 h-3.5" /> Central Export Hub</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Custom Financial Statement & Particulars Export
            </h2>
            <p className="text-sm text-[--text-muted] mt-2 max-w-xl font-medium leading-relaxed">
              Generate comprehensive PDF financial statements or consolidated CSV exports across any date range and select specific modules.
            </p>
          </div>
          <div className="shrink-0">
            <ReportDownloadButton />
          </div>
        </div>
      </div>

      {/* Grid of One-Click Module Exporters */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[--text-muted]">
            Module Quick CSV Exporters
          </h3>
          
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={exportSearch}
              onChange={(e) => setExportSearch(e.target.value)}
              placeholder="Filter exporter modules..."
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500 transition-all font-medium"
            />
            <span className="text-xs font-mono text-[--text-muted] shrink-0">
              {filteredCards.length} / {exportCards.length} Ready
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => (
            <div
              key={card.title}
              className="glass-card rich-border p-5 rounded-2xl border border-white/5 hover:border-white/20 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">{card.icon}</div>
                  <span className={`px-2 py-0.5 rounded-full text-[0.625rem] font-mono font-bold border ${
                    card.count > 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/10 text-[--text-muted]"
                  }`}>
                    {card.count} records
                  </span>
                </div>
                <h4 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
                  {card.title}
                </h4>
                <p className="text-xs text-[--text-muted] mt-1 line-clamp-2 leading-relaxed">
                  {card.desc}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className={`text-[0.625rem] font-black uppercase tracking-wider ${card.count > 0 ? "text-emerald-400" : "text-gray-500"}`}>
                  {card.count > 0 ? "Ready to download" : "No records"}
                </span>
                <button
                  type="button"
                  onClick={card.action}
                  disabled={card.count === 0}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-500/40 text-xs font-bold text-white transition-all flex items-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Export {card.badge}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredCards.length === 0 && (
          <div className="p-8 text-center text-xs text-gray-400 rounded-2xl bg-white/[0.02] border border-white/5 mt-4">
            No CSV exporters matching &quot;{exportSearch}&quot;.
          </div>
        )}
      </div>
    </div>
  );
}

