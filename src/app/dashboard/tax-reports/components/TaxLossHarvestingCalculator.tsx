"use client";

import { useMemo, useState } from "react";
import {
  computeTaxLossHarvesting,
  type TaxEngineInput,
} from "@/lib/tax/india-tax-engine";
import { Button } from "@/components/ui/button";
import {
  Scissors,
  TrendingDown,
  TrendingUp,
  Sparkles,
  Info,
  CheckSquare,
  Square,
} from "lucide-react";

const formatINR = (value: number) =>
  value.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

interface Props {
  input: TaxEngineInput;
}

export function TaxLossHarvestingCalculator({ input }: Props) {
  const result = useMemo(() => computeTaxLossHarvesting(input), [input]);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    result.items.forEach((item) => {
      if (item.harvestType !== "Neutral") {
        initial.add(item.id);
      }
    });
    return initial;
  });

  const toggleSelect = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllHarvestable = () => {
    const next = new Set<string>();
    result.items.forEach((item) => {
      if (item.harvestType !== "Neutral") {
        next.add(item.id);
      }
    });
    setSelectedItemIds(next);
  };

  const deselectAll = () => {
    setSelectedItemIds(new Set());
  };

  const simulation = useMemo(() => {
    let simulatedStcgPnl = result.stcgRealized;
    let simulatedLtcgPnl = result.ltcgRealized;

    result.items.forEach((item) => {
      if (selectedItemIds.has(item.id)) {
        if (item.isLtcg) {
          simulatedLtcgPnl += item.unrealizedPnl;
        } else {
          simulatedStcgPnl += item.unrealizedPnl;
        }
      }
    });

    const STCG_RATE = 0.20;
    const LTCG_RATE = 0.125;
    const LTCG_EXEMPTION = 125000;

    const baseStcgTax = Math.max(0, result.stcgRealized) * STCG_RATE;
    const baseLtcgTax = Math.max(0, result.ltcgRealized - LTCG_EXEMPTION) * LTCG_RATE;
    const baseTotalCapitalGainsTax = baseStcgTax + baseLtcgTax;

    const simulatedStcgTax = Math.max(0, simulatedStcgPnl) * STCG_RATE;
    const simulatedLtcgTax = Math.max(0, simulatedLtcgPnl - LTCG_EXEMPTION) * LTCG_RATE;
    const simulatedTotalCapitalGainsTax = simulatedStcgTax + simulatedLtcgTax;

    const netTaxSavings = Math.max(0, baseTotalCapitalGainsTax - simulatedTotalCapitalGainsTax);

    return {
      simulatedStcgPnl,
      simulatedLtcgPnl,
      baseTotalCapitalGainsTax,
      simulatedTotalCapitalGainsTax,
      netTaxSavings,
    };
  }, [result, selectedItemIds]);

  return (
    <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-6 shadow-2xl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-wider mb-2">
            <Scissors className="w-3.5 h-3.5" />
            <span>Tax Loss & Gain Harvesting Studio</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            STCG & LTCG Tax Optimizer
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Section 112A (12.5% LTCG &gt; ₹1.25L) & Section 111A (20% STCG). Book unrealized losses to cut capital gains tax before FY ends (March 31).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAllHarvestable}>
            Select Recommended
          </Button>
          <Button variant="ghost" size="sm" onClick={deselectAll}>
            Reset
          </Button>
        </div>
      </div>

      {/* Hero Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Base Tax */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-1">
          <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Current Tax Payable</span>
          <p className="text-2xl font-black text-rose-400">{formatINR(simulation.baseTotalCapitalGainsTax)}</p>
          <p className="text-[10px] text-gray-400">Capital Gains Tax before harvesting</p>
        </div>

        {/* Card 2: Simulated Tax */}
        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-1">
          <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider">Simulated Tax</span>
          <p className="text-2xl font-black text-cyan-300">{formatINR(simulation.simulatedTotalCapitalGainsTax)}</p>
          <p className="text-[10px] text-gray-400">After harvesting selected positions</p>
        </div>

        {/* Card 3: Net Tax Saved */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
          <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Estimated Tax Saved</span>
          <p className="text-2xl font-black text-emerald-300 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            {formatINR(simulation.netTaxSavings)}
          </p>
          <p className="text-[10px] text-emerald-400 font-bold">Direct tax savings in ₹</p>
        </div>

        {/* Card 4: Unused ₹1.25L Exemption */}
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1">
          <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider">Unused LTCG Exemption</span>
          <p className="text-2xl font-black text-purple-300">{formatINR(result.unusedLtcgExemption)}</p>
          <p className="text-[10px] text-gray-400">Remaining 100% tax-free quota</p>
        </div>
      </div>

      {/* Smart Recommendations Alert */}
      {result.maxPotentialTaxSavings > 0 ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-transparent border border-amber-500/30 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-black text-white text-sm">
              Tax Harvesting Strategy Recommendation
            </p>
            <p className="text-gray-300">
              You have <strong className="text-rose-400">{formatINR(result.totalLossHarvestable)}</strong> in unrealized losses and <strong className="text-emerald-400">{formatINR(result.totalGainHarvestableTaxFree)}</strong> in tax-free LTCG gains.
              Harvesting these positions before March 31 can save you up to <strong className="text-amber-300">{formatINR(result.maxPotentialTaxSavings)}</strong> in income tax!
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3 text-xs text-gray-400">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>No immediate loss harvesting required. Portfolio has zero unrealized loss positions.</span>
        </div>
      )}

      {/* Interactive Simulator Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-300 flex items-center gap-2">
            <span>Portfolio Positions & Harvest Simulator</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {result.items.length} Holdings Analyzed
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black uppercase text-gray-400 tracking-wider">
                <th className="p-3 w-10 text-center">Select</th>
                <th className="p-3">Holding / Asset</th>
                <th className="p-3">Type & Period</th>
                <th className="p-3 text-right">Invested</th>
                <th className="p-3 text-right">Current Value</th>
                <th className="p-3 text-right">Unrealized P&L</th>
                <th className="p-3">Harvest Strategy</th>
                <th className="p-3 text-right">Tax Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {result.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500 italic">
                    No holdings found in portfolio. Add investments or mutual funds to run tax loss harvesting.
                  </td>
                </tr>
              ) : (
                result.items.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => toggleSelect(item.id)}
                      className={`hover:bg-white/[0.04] transition-all cursor-pointer select-none ${
                        isSelected ? "bg-cyan-500/[0.06]" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400 mx-auto" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-600 mx-auto" />
                        )}
                      </td>
                      <td className="p-3 font-bold text-white">
                        {item.name}
                        <span className="block text-[10px] text-gray-500 font-normal">{item.assetClass}</span>
                      </td>
                      <td className="p-3 font-mono text-[11px]">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.isLtcg
                              ? "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                              : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          }`}
                        >
                          {item.isLtcg ? "LTCG (>365d)" : "STCG (≤365d)"}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">{formatINR(item.investedValue)}</td>
                      <td className="p-3 text-right font-mono font-bold text-white">{formatINR(item.currentValue)}</td>
                      <td className="p-3 text-right font-mono font-bold">
                        <span className={item.unrealizedPnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {item.unrealizedPnl >= 0 ? "+" : ""}
                          {formatINR(item.unrealizedPnl)}
                        </span>
                      </td>
                      <td className="p-3">
                        {item.harvestType === "Loss Harvest" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase">
                            <TrendingDown className="w-3 h-3 text-rose-400" />
                            Loss Harvest
                          </span>
                        )}
                        {item.harvestType === "Gain Harvest (LTCG Exemption)" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            100% Tax Free Gain
                          </span>
                        )}
                        {item.harvestType === "Neutral" && (
                          <span className="text-gray-500 text-[10px]">No Action Needed</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold">
                        {item.potentialTaxSavings > 0 ? (
                          <span className="text-emerald-400">+ Save {formatINR(item.potentialTaxSavings)}</span>
                        ) : (
                          <span className="text-gray-500">₹0</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
