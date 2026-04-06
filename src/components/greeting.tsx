"use client";

import { useUser } from "@/context/user-context";

export default function Greeting() {
  const { username } = useUser();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const todayLabel = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        Daily overview
      </div>

      <div className="space-y-3">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {greeting}, {username}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--muted-strong)] sm:text-base">
          Your workspace is tuned to help you spot cash movement, rebalance accounts,
          and keep the month feeling under control.
        </p>
      </div>

      <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--muted)]">
        {todayLabel}
      </p>
    </div>
  );
}
