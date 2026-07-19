"use client";

import React from "react";
import dynamic from "next/dynamic";
import { exportToCSV } from "@/lib/export-csv";
import type { FinanceData } from "@/hooks/use-finance-data";

const ReportDownloadButton = dynamic(
  () => import("../../components/ReportDownloadButton"),
  { ssr: false }
);

interface DataExportsTabProps {
  transactions: FinanceData["transactions"];
  accounts: FinanceData["accounts"];
  incomes: FinanceData["incomes"];
  expenses: FinanceData["expenses"];
  stockTrades: FinanceData["stockTrades"];
  mutualFundTrades: FinanceData["mutualFundTrades"];
  bondTransactions: FinanceData["bondTransactions"];
  forexTrades: FinanceData["forexTrades"];
  fnoTrades: FinanceData["fnoTrades"];
}

export default function DataExportsTab({
  transactions = [],
  accounts = [],
  incomes = [],
  expenses = [],
  stockTrades = [],
  mutualFundTrades = [],
  bondTransactions = [],
  forexTrades = [],
  fnoTrades = [],
}: DataExportsTabProps) {
  return (
    <div className="max-w-4xl animate-fade-in-up">
      <div className="glass-card-static p-6 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-cyan-500/70" />
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Data & Statement Exports</h2>
            <p className="text-xs text-[--text-muted]">Download your financial records and asset statements in portable file formats.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PDF Statement */}
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📄</span> Financial Statement (PDF)
              </h3>
              <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                Generate and download a comprehensive monthly financial performance report in PDF.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <ReportDownloadButton />
            </div>
          </div>

          {/* Transactions CSV */}
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📊</span> Transaction History (CSV)
              </h3>
              <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                Export your complete income, expense, and ledger transaction log to spreadsheet-ready CSV format.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() =>
                  exportToCSV(
                    transactions.map((t) => ({
                      date: t.date ? new Date(t.date).toISOString().split("T")[0] : "",
                      description: t.description,
                      type: t.type.toUpperCase(),
                      category: t.category || "Others",
                      amount: t.amount,
                      account: accounts?.find((a) => a.id === t.account_id)?.name || "N/A",
                    })),
                    "transactions_history",
                    [
                      { key: "date", label: "Date" },
                      { key: "description", label: "Description" },
                      { key: "type", label: "Type" },
                      { key: "category", label: "Category" },
                      { key: "amount", label: "Amount" },
                      { key: "account", label: "Account" },
                    ]
                  )
                }
                disabled={!transactions || transactions.length === 0}
                className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Export Transactions ({transactions?.length || 0})
              </button>
            </div>
          </div>

          {/* Incomes CSV */}
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>💰</span> Incomes Log (CSV)
              </h3>
              <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                Export your detailed income source logs (salary, freelance, dividends) to CSV.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() =>
                  exportToCSV(
                    incomes.map((i) => ({
                      date: i.date ? new Date(i.date).toISOString().split("T")[0] : "",
                      description: i.description,
                      category: i.category,
                      amount: Number(i.amount),
                      account: accounts?.find((a) => a.id === i.account_id)?.name || "Direct Log",
                    })),
                    "incomes_log",
                    [
                      { key: "date", label: "Date" },
                      { key: "description", label: "Description" },
                      { key: "category", label: "Category" },
                      { key: "amount", label: "Amount" },
                      { key: "account", label: "Account" },
                    ]
                  )
                }
                disabled={!incomes || incomes.length === 0}
                className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Export Incomes ({incomes?.length || 0})
              </button>
            </div>
          </div>

          {/* Expenses CSV */}
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>💸</span> Expenses Log (CSV)
              </h3>
              <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                Export your categorized expenditure and bill payment history to CSV.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() =>
                  exportToCSV(
                    expenses.map((e) => ({
                      date: e.date ? new Date(e.date).toISOString().split("T")[0] : "",
                      description: e.description,
                      category: e.category,
                      amount: Number(e.amount),
                      account: accounts?.find((a) => a.id === e.account_id)?.name || "Direct Log",
                    })),
                    "expenses_log",
                    [
                      { key: "date", label: "Date" },
                      { key: "description", label: "Description" },
                      { key: "category", label: "Category" },
                      { key: "amount", label: "Amount" },
                      { key: "account", label: "Account" },
                    ]
                  )
                }
                disabled={!expenses || expenses.length === 0}
                className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Export Expenses ({expenses?.length || 0})
              </button>
            </div>
          </div>

          {/* Stock Trades CSV */}
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📈</span> Stock Trades (CSV)
              </h3>
              <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                Export your equities buy/sell executions and charges to CSV.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() =>
                  exportToCSV(
                    stockTrades.map((s) => ({
                      trade_date: s.trade_date ? new Date(s.trade_date).toISOString().split("T")[0] : "",
                      symbol: s.symbol,
                      trade_type: s.trade_type.toUpperCase(),
                      quantity: Number(s.quantity),
                      price: Number(s.price),
                      total_amount: Number(s.total_amount),
                      charges: Number(s.charges || 0),
                    })),
                    "stock_trades",
                    [
                      { key: "trade_date", label: "Date" },
                      { key: "symbol", label: "Symbol" },
                      { key: "trade_type", label: "Type" },
                      { key: "quantity", label: "Quantity" },
                      { key: "price", label: "Price" },
                      { key: "total_amount", label: "Total Amount" },
                      { key: "charges", label: "Charges" },
                    ]
                  )
                }
                disabled={!stockTrades || stockTrades.length === 0}
                className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Export Stock Trades ({stockTrades?.length || 0})
              </button>
            </div>
          </div>

          {/* Mutual Fund Trades CSV */}
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🏦</span> Mutual Fund Trades (CSV)
              </h3>
              <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                Export your SIP and lumpsum mutual fund transaction logs to CSV.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() =>
                  exportToCSV(
                    mutualFundTrades.map((m) => ({
                      date: m.date ? new Date(m.date).toISOString().split("T")[0] : "",
                      fund_name: m.fund_name,
                      trade_type: m.trade_type.toUpperCase(),
                      units: Number(m.units),
                      nav: Number(m.nav),
                      amount: Number(m.amount),
                    })),
                    "mutual_fund_trades",
                    [
                      { key: "date", label: "Date" },
                      { key: "fund_name", label: "Fund Name" },
                      { key: "trade_type", label: "Type" },
                      { key: "units", label: "Units" },
                      { key: "nav", label: "NAV" },
                      { key: "amount", label: "Amount" },
                    ]
                  )
                }
                disabled={!mutualFundTrades || mutualFundTrades.length === 0}
                className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Export MF Trades ({mutualFundTrades?.length || 0})
              </button>
            </div>
          </div>

          {/* Bond Transactions CSV */}
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🔏</span> Bond Transactions (CSV)
              </h3>
              <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                Export your fixed-income and bond subscription/sale logs to CSV.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() =>
                  exportToCSV(
                    bondTransactions.map((b) => ({
                      transaction_date: b.transaction_date ? new Date(b.transaction_date).toISOString().split("T")[0] : "",
                      bond_id: b.bond_id,
                      transaction_type: b.transaction_type,
                      quantity: Number(b.quantity),
                      price_per_bond: Number(b.price_per_bond),
                      amount: Number(b.amount),
                    })),
                    "bond_transactions",
                    [
                      { key: "transaction_date", label: "Date" },
                      { key: "bond_id", label: "Bond ID" },
                      { key: "transaction_type", label: "Type" },
                      { key: "quantity", label: "Quantity" },
                      { key: "price_per_bond", label: "Price Per Bond" },
                      { key: "amount", label: "Amount" },
                    ]
                  )
                }
                disabled={!bondTransactions || bondTransactions.length === 0}
                className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Export Bond Txns ({bondTransactions?.length || 0})
              </button>
            </div>
          </div>

          {/* Forex Trades CSV */}
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>💱</span> Forex Trades (CSV)
              </h3>
              <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                Export your currency pair trades, entry/exit levels, and PnL to CSV.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() =>
                  exportToCSV(
                    forexTrades.map((f) => ({
                      trade_date: f.trade_date ? new Date(f.trade_date).toISOString().split("T")[0] : "",
                      pair: f.pair,
                      trade_type: f.trade_type,
                      lot_size: Number(f.lot_size),
                      entry_price: Number(f.entry_price),
                      exit_price: Number(f.exit_price || 0),
                      pnl: Number(f.pnl || 0),
                    })),
                    "forex_trades",
                    [
                      { key: "trade_date", label: "Date" },
                      { key: "pair", label: "Pair" },
                      { key: "trade_type", label: "Type" },
                      { key: "lot_size", label: "Lot Size" },
                      { key: "entry_price", label: "Entry Price" },
                      { key: "exit_price", label: "Exit Price" },
                      { key: "pnl", label: "PnL" },
                    ]
                  )
                }
                disabled={!forexTrades || forexTrades.length === 0}
                className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Export Forex Trades ({forexTrades?.length || 0})
              </button>
            </div>
          </div>

          {/* FnO Trades CSV */}
          <div className="flex flex-col justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📊</span> FnO Trades (CSV)
              </h3>
              <p className="text-xs text-[--text-muted] mt-1.5 leading-relaxed">
                Export your futures & options derivatives trading history to CSV.
              </p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() =>
                  exportToCSV(
                    fnoTrades.map((f) => ({
                      trade_date: f.trade_date ? new Date(f.trade_date).toISOString().split("T")[0] : "",
                      symbol: f.symbol,
                      instrument_type: f.instrument_type,
                      strike_price: f.strike_price ? Number(f.strike_price) : "",
                      expiry_date: f.expiry_date,
                      trade_type: f.trade_type,
                      quantity: Number(f.quantity),
                      entry_price: Number(f.entry_price),
                      exit_price: f.exit_price ? Number(f.exit_price) : "",
                      pnl: Number(f.pnl || 0),
                    })),
                    "fno_trades",
                    [
                      { key: "trade_date", label: "Date" },
                      { key: "symbol", label: "Symbol" },
                      { key: "instrument_type", label: "Type" },
                      { key: "strike_price", label: "Strike" },
                      { key: "expiry_date", label: "Expiry" },
                      { key: "trade_type", label: "Action" },
                      { key: "quantity", label: "Qty" },
                      { key: "entry_price", label: "Entry Price" },
                      { key: "exit_price", label: "Exit Price" },
                      { key: "pnl", label: "PnL" },
                    ]
                  )
                }
                disabled={!fnoTrades || fnoTrades.length === 0}
                className="bg-white/5 hover:bg-white/10 disabled:opacity-40 text-white border border-white/10 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Export FnO Trades ({fnoTrades?.length || 0})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
