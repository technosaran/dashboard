"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/user-context";
import { createClient } from "@/lib/supabase-browser";

export default function Greeting() {
  const { username, loading } = useUser();
  const [isLive, setIsLive] = useState(false);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const emoji = hour < 12 ? "☀️" : hour < 18 ? "🌤️" : "🌙";

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel("system-health")
      .on("system", { event: "presence" }, () => {})
      .subscribe((status) => {
        setIsLive(status === "SUBSCRIBED");
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-1">
        <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isLive ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-rose-500"}`} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">
          {isLive ? "Automatic Real-time Connection Active" : "Establishing Secure Handshake..."}
        </span>
      </div>
      <h1
        className="text-4xl font-bold tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {greeting},{" "}
        {loading ? (
          <span className="inline-block w-32 h-10 bg-[var(--glass-border)] animate-pulse rounded-lg align-middle" />
        ) : (
          <span className="gradient-text">{username || "User"}</span>
        )}{" "}
        {!loading && <span className="inline-block animate-float">{emoji}</span>}
      </h1>
    </div>
  );
}

