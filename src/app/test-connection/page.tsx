"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/lib/database.types";

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

  const testConnection = useCallback(async () => {
    try {
      const supabase = createClient();

      // Test 1: Check Supabase client initialization
      console.log("✓ Supabase client created");

      // Test 2: Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        setStatus({ connected: false, user: null, accounts: [], error: `Auth error: ${authError.message}` });
        return;
      }
      console.log("✓ Auth check passed", user);

      // Test 3: Try to fetch accounts
      const { data: accounts, error: dbError } = await supabase
        .from("accounts")
        .select("*")
        .limit(5);

      if (dbError) {
        setStatus({ connected: true, user, accounts: [], error: `Database error: ${dbError.message}` });
        return;
      }

      console.log("✓ Database query successful", accounts);

      setStatus({
        connected: true,
        user,
        accounts: (accounts as Account[]) || [],
        error: null,
      });
    } catch (err) {
      setStatus({
        connected: false,
        user: null,
        accounts: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    testConnection();
  }, [testConnection]);

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Backend Connection Test</h1>

        <div className="space-y-6">
          {/* Connection Status */}
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h2 className="text-xl font-semibold text-white mb-4">Connection Status</h2>
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full ${
                  status.connected ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <span className="text-white">
                {status.connected ? "Connected to Supabase" : "Not Connected"}
              </span>
            </div>
          </div>

          {/* Authentication Status */}
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h2 className="text-xl font-semibold text-white mb-4">Authentication</h2>
            {status.user ? (
              <div className="space-y-2">
                <p className="text-emerald-400">✓ User authenticated</p>
                <div className="bg-zinc-800 rounded-lg p-4 mt-2">
                  <p className="text-zinc-400 text-sm">User ID: {status.user.id}</p>
                  <p className="text-zinc-400 text-sm">Email: {status.user.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-yellow-400">⚠ No user logged in</p>
            )}
          </div>

          {/* Database Query Status */}
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h2 className="text-xl font-semibold text-white mb-4">Database Query</h2>
            {status.error ? (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400">✗ Error: {status.error}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-emerald-400">✓ Successfully queried accounts table</p>
                <p className="text-zinc-400 text-sm">Found {status.accounts.length} accounts</p>
                {status.accounts.length > 0 && (
                  <div className="bg-zinc-800 rounded-lg p-4 mt-2">
                    <p className="text-white font-medium mb-2">Sample Accounts:</p>
                    {status.accounts.map((acc) => (
                      <div key={acc.id} className="text-zinc-400 text-sm py-1">
                        • {acc.name} ({acc.type}) - {acc.currency} {acc.balance}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Environment Variables */}
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h2 className="text-xl font-semibold text-white mb-4">Environment Variables</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">NEXT_PUBLIC_SUPABASE_URL:</span>
                <span className={`text-sm ${process.env.NEXT_PUBLIC_SUPABASE_URL ? "text-emerald-400" : "text-red-400"}`}>
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? "✓ Set" : "✗ Missing"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-400">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:</span>
                <span className={`text-sm ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "text-emerald-400" : "text-red-400"}`}>
                  {process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "✓ Set" : "✗ Missing"}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h2 className="text-xl font-semibold text-white mb-4">Actions</h2>
            <button
              onClick={testConnection}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              Retest Connection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
