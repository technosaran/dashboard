"use client";

import { useMemo, useState } from "react";
import { useFinanceData } from "@/hooks/use-finance-data";
import { format, parseISO, differenceInDays } from "date-fns";
import type { Tables } from "@/lib/database.types";

type Investment = Tables<"investments">;
type StockTrade = Tables<"stock_trades">;

interface TaxableGain {
  name: string;
  symbol: string;
  buyDate: string;
  sellDate: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  gain: number;
  holdingPeriod: number;
  type: "STCG" | "LTCG";
}

export default function TaxClient() {
  const { data: { investments, stockTrades }, isValidating } = useFinanceData();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Calculate capital gains from stock trades
  const taxData = useMemo(() => {
    const gains: TaxableGain[] = [];
    
    // Process sell trades
    const sellTrades = stockTrades.filter(t => t.trade_type === "sell");
    
    sellTrades.forEach(sell => {
      // Find corresponding buy trades for this investment
      const buyTrades = stockTrades.filter(
        t => t.investment_id === sell.investment_id && 
        t.trade_type === "buy" &&
        t.trade_date && sell.trade_date &&
        new Date(t.trade_date) < new Date(sell.trade_date)
      );
      
      if (buyTrades.length === 0) return;
      
      // Find investment details
      const investment = investments.find(i => i.id === sell.investment_id);
      if (!investment) return;
      
      // Use FIFO (First In First Out) method
      const buyTrade = buyTrades[0];
      
      // Skip if dates are null
      if (!sell.trade_date || !buyTrade.trade_date) return;
      
      const holdingDays = differenceInDays(
        parseISO(sell.trade_date),
        parseISO(buyTrade.trade_date)
      );
      
      // For equity: LTCG if held > 365 days, else STCG
      const isLongTerm = holdingDays > 365;
      
      const gain = (sell.price - buyTrade.price) * sell.quantity;
      
      // Filter by selected year
      const sellYear = new Date(sell.trade_date).getFullYear();
      if (sellYear !== selectedYear) return;
      
      gains.push({
        name: investment.name || "Unknown",
        symbol: sell.symbol || "",
        buyDate: buyTrade.trade_date,
        sellDate: sell.trade_date,
        buyPrice: buyTrade.price,
        sellPrice: sell.price,
        quantity: sell.quantity,
        gain,
        holdingPeriod: holdingDays,
        type: isLongTerm ? "LTCG" : "STCG"
      });
    });
    
    const stcgGains = gains.filter(g => g.type === "STCG");
    const ltcgGains = gains.filter(g => g.type === "LTCG");
    
    const totalSTCG = stcgGains.reduce((sum, g) => sum + g.gain, 0);
    const totalLTCG = ltcgGains.reduce((sum, g) => sum + g.gain, 0);
    
    // Tax calculations (as per Indian tax laws - simplified)
    // STCG: 15% on gains
    // LTCG: 10% on gains above ₹1 lakh
    const stcgTax = totalSTCG * 0.15;
    const ltcgTaxable = Math.max(0, totalLTCG - 100000);
    const ltcgTax = ltcgTaxable * 0.10;
    
    return {
      stcgGains,
      ltcgGains,
      totalSTCG,
      totalLTCG,
      stcgTax,
      ltcgTax,
      totalTax: stcgTax + ltcgTax,
      allGains: gains
    };
  }, [stockTrades, investments, selectedYear]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    stockTrades.forEach(t => {
      if (t.trade_date) {
        years.add(new Date(t.trade_date).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [stockTrades]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">
              Tax Summary
            </h1>
            <p className="text-[--text-secondary] text-[13px] md:text-sm mt-1">
              Capital gains tax calculations for FY {selectedYear}-{(selectedYear + 1).toString().slice(-2)}
            </p>
          </div>
          <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="input-premium py-2 text-sm"
          >
            {availableYears.length === 0 ? (
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            ) : (
              availableYears.map(year => (
                <option key={year} value={year}>FY {year}-{(year + 1).toString().slice(-2)}</option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card-static p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-3">
            Short Term Capital Gains
          </p>
          <div className="flex flex-col gap-2">
            <h3 className="text-2xl font-black text-[--text-primary]">
              ₹{taxData.totalSTCG.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-sm font-bold text-[--text-muted]">
              Tax @ 15%: ₹{taxData.stcgTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="mt-4 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
              {taxData.stcgGains.length} transactions
            </p>
          </div>
        </div>

        <div className="glass-card-static p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-3">
            Long Term Capital Gains
          </p>
          <div className="flex flex-col gap-2">
            <h3 className="text-2xl font-black text-[--text-primary]">
              ₹{taxData.totalLTCG.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-sm font-bold text-[--text-muted]">
              Tax @ 10%: ₹{taxData.ltcgTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="mt-4 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
              {taxData.ltcgGains.length} transactions
            </p>
          </div>
        </div>

        <div className="glass-card-static p-8 bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-3">
            Total Tax Liability
          </p>
          <div className="flex flex-col gap-2">
            <h3 className="text-3xl font-black text-[--accent-primary]">
              ₹{taxData.totalTax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </h3>
            <p className="text-sm font-bold text-[--text-muted]">
              For FY {selectedYear}-{(selectedYear + 1).toString().slice(-2)}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      {taxData.allGains.length === 0 ? (
        <div className="glass-card-static p-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
            <svg className="w-8 h-8 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-black text-[--text-primary] mb-2">No Taxable Events</h3>
          <p className="text-sm text-[--text-muted]">
            No capital gains transactions found for FY {selectedYear}-{(selectedYear + 1).toString().slice(-2)}
          </p>
        </div>
      ) : (
        <div className="glass-card-static overflow-hidden">
          <div className="p-6 border-b border-white/5 bg-white/[0.01]">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">
              Transaction Details
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Asset</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Buy Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Sell Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Holding</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Type</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] text-right">Gain/Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {taxData.allGains.map((gain, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.015] transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[--text-primary]">{gain.symbol}</span>
                        <span className="text-[11px] text-[--text-muted] mt-0.5">{gain.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className="text-sm text-[--text-secondary]">
                        {format(parseISO(gain.buyDate), "MMM d, yyyy")}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className="text-sm text-[--text-secondary]">
                        {format(parseISO(gain.sellDate), "MMM d, yyyy")}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className="text-sm font-bold text-[--text-secondary]">
                        {gain.holdingPeriod} days
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        gain.type === "LTCG" 
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                      }`}>
                        {gain.type}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right">
                      <span className={`text-base font-black ${gain.gain >= 0 ? 'text-[--success]' : 'text-[--danger]'}`}>
                        {gain.gain >= 0 ? '+' : ''}₹{gain.gain.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tax Info */}
      <div className="glass-card-static p-8 bg-gradient-to-br from-blue-500/5 to-transparent border-blue-500/10">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-black text-[--text-primary] mb-2">Tax Calculation Notes</h4>
            <ul className="text-[13px] text-[--text-muted] space-y-1 leading-relaxed">
              <li>• STCG (Short Term): Equity held ≤ 365 days, taxed @ 15%</li>
              <li>• LTCG (Long Term): Equity held &gt; 365 days, taxed @ 10% on gains above ₹1 lakh</li>
              <li>• Calculations use FIFO (First In First Out) method</li>
              <li>• This is a simplified calculation. Consult a tax professional for accurate filing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
