"use client";

import React from "react";

export interface CustomChartTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

export interface CustomChartTooltipProps {
  active?: boolean;
  payload?: CustomChartTooltipPayloadItem[];
  label?: string;
  currency?: string;
}

export function CustomChartTooltip({ active, payload, label, currency = "₹" }: CustomChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-xl transition-all duration-200 min-w-[140px]">
      {label && <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase border-b border-slate-800 pb-1">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry: CustomChartTooltipPayloadItem, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color || "#d4af37" }} />
              <span className="font-medium text-slate-300">{entry.name}:</span>
            </div>
            <span className="font-mono font-semibold text-amber-200">
              {currency}{Number(entry.value || 0).toLocaleString('en-IN')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

