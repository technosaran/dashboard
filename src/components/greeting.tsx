"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function Greeting() {
  const [email, setEmail] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email || null);
    });
  }, [supabase]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const displayName = email ? email.split("@")[0] : "User";

  return (
    <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
      {greeting}, {displayName} 👋
    </h1>
  );
}
