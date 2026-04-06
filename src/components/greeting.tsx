"use client";

import { useUser } from "@/context/user-context";

export default function Greeting() {
  const { username } = useUser();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
      {greeting}, {username} 👋
    </h1>
  );
}
