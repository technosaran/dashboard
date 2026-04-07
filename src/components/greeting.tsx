"use client";

import { useUser } from "@/context/user-context";

export default function Greeting() {
  const { username } = useUser();
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
        <span className="gradient-text">{username}</span>{" "}
        <span className="inline-block animate-float">{emoji}</span>
      </h1>
    </div>
  );
}
