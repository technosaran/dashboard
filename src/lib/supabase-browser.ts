import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (client) return client;
  
  client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      realtime: {
        params: {
          eventsPerSecond: 10, // Supabase default — matches free/pro tier server-side limit
        },
        heartbeatIntervalMs: 15000, // More frequent keepalive for stable connection
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'x-client-info': 'supabase-js-web',
        },
      },
    }
  );

  // Clear singleton on sign-out to prevent stale session leaks
  const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      subscription.unsubscribe();
      client = null;
    }
  });
  
  return client;
}
