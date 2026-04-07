"use client";

import { useUser } from "@/context/user-context";

export default function Greeting() {
  const { username, loading } = useUser();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const emoji = hour < 12 ? "☀️" : hour < 18 ? "🌤️" : "🌙";

  return (
    <div className="animate-fade-in-up">
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

