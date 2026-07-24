import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL is required to initialize Supabase Server Client.");
  }
  if (!anonKey) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required to initialize Supabase Server Client.");
  }

  const cookieStore = await cookies();
  const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30; // 30 days (1 month persistent session)

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                maxAge: options?.maxAge ?? THIRTY_DAYS_IN_SECONDS,
                sameSite: options?.sameSite ?? "lax",
                path: options?.path ?? "/",
              })
            );
          } catch {}
        },
      },
    }
  );
}
