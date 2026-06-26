"use client";

import React from "react";

export type TabItem<T extends string = string> = {
  key: T;
  label: string;
  badge?: number | string;
};

interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  /** "underline" renders border-bottom tabs (Budget, Goals style).
   *  "pill" renders rounded pill tabs (Settings style). */
  variant?: "underline" | "pill";
  className?: string;
}

export function Tabs<T extends string = string>({
  items,
  active,
  onChange,
  variant = "underline",
  className = "",
}: TabsProps<T>) {
  if (variant === "pill") {
    return (
      <div className={`flex overflow-x-auto gap-2 pb-2 custom-scrollbar ${className}`}>
        {items.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
              active === tab.key
                ? "bg-[--accent-primary] text-white shadow-lg shadow-indigo-500/20"
                : "bg-white/5 text-[--text-secondary] hover:bg-white/10 hover:text-white border border-white/5"
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[9px] font-black ${
                  active === tab.key ? "bg-white/20 text-white" : "bg-white/10 text-white"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // underline variant
  return (
    <div className={`flex border-b border-white/10 overflow-x-auto custom-scrollbar ${className}`}>
      {items.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            active === tab.key
              ? "border-[--accent-primary] text-[--accent-primary]"
              : "border-transparent text-[--text-muted] hover:text-white"
          }`}
        >
          {tab.label}
          {tab.badge !== undefined && (
            <span
              className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[9px] font-black ${
                active === tab.key ? "bg-[--accent-primary]/20 text-[--accent-primary]" : "bg-white/10 text-white"
              }`}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
