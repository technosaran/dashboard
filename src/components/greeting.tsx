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
        className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight leading-tight [font-family:'Outfit',sans-serif]"
        style={{ color: "var(--text-primary)" }}
      >
        {greeting},{" "}
        {loading ? (
          <span className="inline-block w-24 h-8 rounded-lg align-middle skeleton" />
        ) : (
          <span className="gradient-text">{username || "User"}</span>
        )}{" "}
        {!loading && <span className="inline-block animate-float ml-1">{emoji}</span>}
      </h1>
    </div>
  );
}
