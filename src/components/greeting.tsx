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
      <h1
        className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tight leading-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {greeting},{" "}
        {loading ? (
          <span className="inline-block w-24 h-8 bg-[var(--glass-border)] animate-pulse rounded-lg align-middle" />
        ) : (
          <span className="gradient-text">{username || "User"}</span>
        )}{" "}
        {!loading && <span className="inline-block animate-float ml-1">{emoji}</span>}
      </h1>
    </div>
  );
}

