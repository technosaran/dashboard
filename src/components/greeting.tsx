"use client";

import { useUser } from "@/context/user-context";

type GreetingProps = {
  monthlySpend?: number;
  monthlyIncome?: number;
  budgetLimit?: number;
};

export default function Greeting({
  monthlySpend: _monthlySpend = 0,
  monthlyIncome: _monthlyIncome = 0,
  budgetLimit: _budgetLimit = 0,
}: GreetingProps) {
  const { username, loading } = useUser();

  const now = new Date();
  const hour = now.getHours();

  const greetingInfo = (() => {
    if (hour >= 5 && hour < 12) {
      return {
        text: "Good morning",
        emoji: "☀️",
        subtitle: "Here is a quick snapshot of your accounts, net worth, and monthly cashflow.",
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        text: "Good afternoon",
        emoji: "🌤️",
        subtitle: "Check in on your monthly spend, recent transactions, and portfolio health.",
      };
    }
    if (hour >= 17 && hour < 21) {
      return {
        text: "Good evening",
        emoji: "🌆",
        subtitle: "Review your daily ledger entries and progress toward your financial goals.",
      };
    }
    return {
      text: "Good night",
      emoji: "🌙",
      subtitle: "All your bank balances, stock holdings, and expenses are in sync.",
    };
  })();

  return (
    <div className="animate-fade-in space-y-3 select-none">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal tracking-tight leading-tight text-white flex flex-wrap items-center gap-3">
            {!loading && <span className="inline-block hover:scale-110 transition-transform duration-300 cursor-default">{greetingInfo.emoji}</span>}
            <span>{greetingInfo.text},</span>{" "}
            {loading ? (
              <span className="inline-block w-36 h-9 rounded-xl align-middle bg-slate-800/60 skeleton-shimmer" />
            ) : (
              <span className="text-amber-300 font-sans font-semibold">
                {username || "there"}
              </span>
            )}
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-slate-400 font-sans leading-relaxed mt-2 max-w-2xl">
            {greetingInfo.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
