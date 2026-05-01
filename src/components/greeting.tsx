"use client";

import { useUser } from "@/context/user-context";

export default function Greeting() {
  const { username, loading } = useUser();
  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
  const emoji = hour < 5 ? "🌙" : hour < 12 ? "☀️" : hour < 17 ? "🌤️" : hour < 21 ? "🌆" : "🌙";

  return (
    <div className="animate-fade-in-up">
      <h1
        className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight leading-tight [font-family:'Outfit',sans-serif]"
        style={{ color: "var(--text-primary)" }}
      >
        {!loading && <span className="inline-block animate-float mr-2">{emoji}</span>}
        {greeting},{" "}
        {loading ? (
          <span className="inline-block w-24 h-8 rounded-lg align-middle skeleton" />
        ) : (
          <span className="gradient-text">{username || "User"}</span>
        )}
      </h1>
    </div>
  );
}
