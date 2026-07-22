"use client";

import { useUser } from "@/context/user-context";
import { format } from "date-fns";
import { useHasMounted } from "@/hooks/use-has-mounted";

export default function Greeting() {
  const { username, loading } = useUser();
  const mounted = useHasMounted();

  const now = new Date();
  const hour = now.getHours();

  const greeting =
    hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
  const emoji = hour < 5 ? "🌙" : hour < 12 ? "☀️" : hour < 17 ? "🌤️" : hour < 21 ? "🌆" : "🌙";

  const subtitle =
    hour < 12
      ? "Here is your morning financial overview and live market status."
      : hour < 17
      ? "Here is your mid-day portfolio summary and net worth allocation."
      : "Here is your end-of-day financial performance and asset breakdown.";

  const formattedDate = mounted ? format(now, "EEEE, MMMM d, yyyy") : "";

  return (
    <div className="animate-fade-in-up space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-black uppercase tracking-[0.2em] text-[--accent-primary] bg-[--accent-primary]/10 border border-[--accent-primary]/20 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.15)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[--accent-primary] animate-ping" />
          Terminal Live
        </span>
        {formattedDate && (
          <span className="text-xs font-semibold text-[--text-muted]">
            {formattedDate}
          </span>
        )}
      </div>

      <h1
        className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight [font-family:'Outfit',sans-serif]"
        style={{ color: "var(--text-primary)" }}
      >
        {!loading && <span className="inline-block animate-float mr-2">{emoji}</span>}
        {greeting},{" "}
        {loading ? (
          <span className="inline-block w-32 h-10 rounded-xl align-middle skeleton" />
        ) : (
          <span className="gradient-text">{username || "User"}</span>
        )}
      </h1>

      <p className="text-xs sm:text-sm text-[--text-muted] font-medium leading-relaxed max-w-xl">
        {subtitle}
      </p>
    </div>
  );
}
