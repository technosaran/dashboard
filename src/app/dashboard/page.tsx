"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Greeting from "@/components/greeting";
import type { Tables } from "@/lib/database.types";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase-browser";

type Account = Tables<"accounts">;

const supabase = createClient();

const quickLinks = [
  {
    href: "/dashboard/accounts",
    label: "Review accounts",
    detail: "Update balances and tidy allocations.",
  },
  {
    href: "/dashboard/transfers",
    label: "Move money",
    detail: "Sweep funds between accounts quickly.",
  },
  {
    href: "/dashboard/settings",
    label: "Tune workspace",
    detail: "Personalize the dashboard and profile.",
  },
];

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadOverview() {
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (!user) {
        setAccounts([]);
        setLoading(false);
        return;
      }

      const { data, error: accountsError } = await supabase
        .from("accounts")
        .select("*")
        .eq("user_id", user.id)
        .order("balance", { ascending: false });

      if (!active) {
        return;
      }

      if (accountsError) {
        setError(accountsError.message);
      } else {
        setAccounts(data || []);
      }

      setLoading(false);
    }

    void loadOverview();

    const channel = supabase
      .channel("dashboard-accounts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts" },
        () => {
          void loadOverview();
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const accountCount = accounts.length;
  const primaryCurrency = accounts[0]?.currency ?? "USD";
  const liquidBalance = accounts
    .filter((account) => account.type === "checking" || account.type === "savings")
    .reduce((sum, account) => sum + account.balance, 0);
  const investmentBalance = accounts
    .filter((account) => account.type === "investment")
    .reduce((sum, account) => sum + account.balance, 0);
  const averageBalance = accountCount ? totalBalance / accountCount : 0;
  const topAccount = accounts[0] ?? null;

  return (
    <div className="flex h-full flex-col gap-8">
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-6">
          <Greeting />

          <div className="grid gap-3 sm:grid-cols-3">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="metric-tile group rounded-[24px] p-4 transition hover:-translate-y-0.5 hover:border-[var(--border-strong)]"
              >
                <p className="text-sm font-semibold tracking-tight text-white">{link.label}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{link.detail}</p>
                <div className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.24em] text-[var(--accent)]">
                  Open
                  <svg className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="app-panel-soft relative overflow-hidden rounded-[32px] p-6 sm:p-7">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-70" />
          <div className="absolute -right-14 top-8 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(120,199,255,0.28),transparent_65%)]" />
          <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(88,213,170,0.24),transparent_65%)]" />

          <div className="relative">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--muted)]">
              Combined balance
            </p>
            {loading ? (
              <p className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Loading overview...
              </p>
            ) : (
              <p className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {formatCurrency(totalBalance, primaryCurrency)}
              </p>
            )}
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--muted-strong)]">
              A clear view across day-to-day cash, long-term allocations, and the next move
              you should make.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Linked accounts</p>
                <p className="mt-3 text-3xl font-semibold text-white">{accountCount}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Each one updates live in this view.</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Average balance</p>
                <p className="mt-3 text-3xl font-semibold text-white">
                  {formatCurrency(averageBalance, primaryCurrency)}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">Useful for spotting outliers fast.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[24px] border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          We could not refresh the overview right now: {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="app-panel rounded-[30px] p-6 sm:p-7">
          <div className="flex flex-col gap-2 border-b border-white/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--muted)]">
                Allocation pulse
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Where the money sits today
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">
              Your largest balances rise to the top so you can see concentration quickly.
            </p>
          </div>

          {accountCount === 0 && !loading ? (
            <div className="mt-8 rounded-[24px] border border-dashed border-white/10 bg-white/5 p-6">
              <p className="text-lg font-semibold text-white">Add your first account to get started.</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
                Once an account is connected, this overview will show your combined balance,
                distribution, and transfer momentum.
              </p>
              <Link
                href="/dashboard/accounts"
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[rgba(88,213,170,0.12)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition hover:bg-[rgba(88,213,170,0.2)]"
              >
                Create an account
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M12 5v14m7-7H5" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {accounts.slice(0, 5).map((account, index) => {
                const share = totalBalance > 0 ? (account.balance / totalBalance) * 100 : 0;

                return (
                  <div
                    key={account.id}
                    className="rounded-[24px] border border-white/8 bg-white/5 p-4 transition hover:border-[var(--border-strong)] hover:bg-white/[0.08]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(88,213,170,0.18),rgba(120,199,255,0.16))] text-sm font-semibold text-white">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold tracking-tight text-white">
                              {account.name}
                            </p>
                            <p className="text-sm capitalize text-[var(--muted)]">{account.type}</p>
                          </div>
                        </div>

                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-cool))]"
                            style={{ width: `${Math.max(share, 6)}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-xl font-semibold text-white">
                          {formatCurrency(account.balance, account.currency)}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {share.toFixed(1)}% of tracked balance
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
          <div className="metric-tile rounded-[28px] p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Liquid funds</p>
            <p className="mt-4 text-3xl font-semibold text-white">
              {formatCurrency(liquidBalance, primaryCurrency)}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Checking and savings balances ready for monthly bills or a quick sweep.
            </p>
          </div>

          <div className="metric-tile rounded-[28px] p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Invested</p>
            <p className="mt-4 text-3xl font-semibold text-white">
              {formatCurrency(investmentBalance, primaryCurrency)}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Long-term allocation parked in investment accounts.
            </p>
          </div>

          <div className="metric-tile rounded-[28px] p-5">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">Largest account</p>
            {topAccount ? (
              <>
                <p className="mt-4 text-2xl font-semibold text-white">{topAccount.name}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
                  {formatCurrency(topAccount.balance, topAccount.currency)} in a{" "}
                  <span className="capitalize">{topAccount.type}</span> account.
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                Add an account to surface concentration and account leaders here.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
