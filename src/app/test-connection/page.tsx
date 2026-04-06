"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase-browser";

type Account = Tables<"accounts">;

export default function TestConnectionPage() {
  const [status, setStatus] = useState<{
    connected: boolean;
    user: User | null;
    accounts: Account[];
    error: string | null;
  }>({
    connected: false,
    user: null,
    accounts: [],
    error: null,
  });

  async function testConnection() {
    try {
      const supabase = createClient();

      console.log("Supabase client created");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        setStatus({
          connected: false,
          user: null,
          accounts: [],
          error: `Auth error: ${authError.message}`,
        });
        return;
      }

      console.log("Auth check passed", user);

      const { data: accounts, error: dbError } = await supabase
        .from("accounts")
        .select("*")
        .limit(5);

      if (dbError) {
        setStatus({
          connected: true,
          user,
          accounts: [],
          error: `Database error: ${dbError.message}`,
        });
        return;
      }

      console.log("Database query successful", accounts);

      setStatus({
        connected: true,
        user,
        accounts: accounts || [],
        error: null,
      });
    } catch (error) {
      setStatus({
        connected: false,
        user: null,
        accounts: [],
        error: error instanceof Error ? error.message : "Unknown connection error",
      });
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-3xl font-bold text-white">Backend Connection Test</h1>

        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">Connection Status</h2>
            <div className="flex items-center gap-3">
              <div
                className={`h-4 w-4 rounded-full ${
                  status.connected ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <span className="text-white">
                {status.connected ? "Connected to Supabase" : "Not Connected"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">Authentication</h2>
            {status.user ? (
              <div className="space-y-2">
                <p className="text-emerald-400">User authenticated</p>
                <div className="mt-2 rounded-lg bg-zinc-800 p-4">
                  <p className="text-sm text-zinc-400">User ID: {status.user.id}</p>
                  <p className="text-sm text-zinc-400">Email: {status.user.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-yellow-400">No user logged in</p>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">Database Query</h2>
            {status.error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                <p className="text-red-400">Error: {status.error}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-emerald-400">Successfully queried accounts table</p>
                <p className="text-sm text-zinc-400">Found {status.accounts.length} accounts</p>
                {status.accounts.length > 0 && (
                  <div className="mt-2 rounded-lg bg-zinc-800 p-4">
                    <p className="mb-2 font-medium text-white">Sample Accounts:</p>
                    {status.accounts.map((account) => (
                      <div key={account.id} className="py-1 text-sm text-zinc-400">
                        - {account.name} ({account.type}) - {account.currency} {account.balance}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">Environment Variables</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">NEXT_PUBLIC_SUPABASE_URL:</span>
                <span
                  className={`text-sm ${
                    process.env.NEXT_PUBLIC_SUPABASE_URL
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? "Set" : "Missing"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:</span>
                <span
                  className={`text-sm ${
                    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "Set" : "Missing"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold text-white">Actions</h2>
            <button
              onClick={() => void testConnection()}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Retest Connection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
