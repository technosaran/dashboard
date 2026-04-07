"use client";

import { useEffect, useState } from "react";
import Greeting from "@/components/greeting";
import { createClient } from "@/lib/supabase-browser";

export default function DashboardPage() {
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accountCount, setAccountCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    loadTotalBalance();

    const channel = supabase
      .channel("dashboard-accounts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts" },
        (payload) => {
          console.log("Dashboard real-time update:", payload);
          loadTotalBalance();
        }
      )
      .subscribe((status) => {
        console.log("Dashboard subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadTotalBalance() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: accounts } = await supabase
      .from("accounts")
      .select("balance")
      .eq("user_id", user.id);

    if (accounts) {
      const total = accounts.reduce((sum, acc) => sum + acc.balance, 0);
      setTotalBalance(total);
      setAccountCount(accounts.length);
    }
    setLoading(false);
  }

  const quickStats = [
    {
      label: "Total Accounts",
      value: accountCount.toString(),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path d="M3 10h18M7 15h2m4 0h2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      color: "#a29bfe",
      bg: "rgba(162, 155, 254, 0.1)",
      borderColor: "rgba(162, 155, 254, 0.15)",
    },
    {
      label: "Active Currency",
      value: "INR",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v12M8 10h8M8 14h8" />
        </svg>
      ),
      color: "#00cec9",
      bg: "rgba(0, 206, 201, 0.1)",
      borderColor: "rgba(0, 206, 201, 0.15)",
    },
    {
      label: "Status",
      value: "Active",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "#55efc4",
      bg: "rgba(85, 239, 196, 0.1)",
      borderColor: "rgba(85, 239, 196, 0.15)",
    },
  ];

  return (
    <div>
      <Greeting />
      <p
        className="mt-2 text-sm animate-fade-in-up delay-1"
        style={{ color: "var(--text-secondary)" }}
      >
        Here&apos;s your financial overview at a glance.
      </p>

      {/* Net Worth Hero Card */}
      <div className="mt-8 animate-fade-in-up delay-2">
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: "var(--radius-2xl)",
            padding: "2px",
            background: "linear-gradient(135deg, rgba(108,92,231,0.5), rgba(0,206,201,0.3), rgba(108,92,231,0.2))",
          }}
        >
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: "calc(var(--radius-2xl) - 2px)",
              background: "linear-gradient(160deg, rgba(108,92,231,0.12) 0%, var(--bg-surface) 40%, rgba(0,206,201,0.08) 100%)",
              padding: "24px 30px",
            }}
          >

            {/* Decorative circles */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: "-40px",
                right: "-20px",
                width: "200px",
                height: "200px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(108,92,231,0.15) 0%, transparent 70%)",
              }}
            />
            <div
              className="absolute pointer-events-none"
              style={{
                bottom: "-60px",
                right: "100px",
                width: "160px",
                height: "160px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(0,206,201,0.1) 0%, transparent 70%)",
              }}
            />

            <div className="relative z-10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: "#55efc4",
                      boxShadow: "0 0 8px rgba(85,239,196,0.5)",
                    }}
                  />
                  <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Total Net Worth
                  </p>
                </div>
                {loading ? (
                  <div className="skeleton" style={{ width: "220px", height: "40px" }} />
                ) : (
                  <>
                    <p
                      className="text-4xl font-bold tracking-tight"
                      style={{ color: "var(--text-primary)" }}
                    >
                      ₹{totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>

                    <div className="flex items-center gap-3 mt-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: "rgba(85, 239, 196, 0.12)",
                          color: "#55efc4",
                          border: "1px solid rgba(85, 239, 196, 0.2)",
                        }}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                        Live
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {accountCount} {accountCount === 1 ? "account" : "accounts"} • Updated just now
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Decorative icon */}
              <div
                className="hidden md:flex items-center justify-center animate-float"
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "var(--radius-xl)",
                  background: "linear-gradient(135deg, rgba(108,92,231,0.15), rgba(0,206,201,0.1))",
                  border: "1px solid rgba(108,92,231,0.2)",
                }}
              >
                <svg className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: "var(--accent-primary-light)" }}>
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
        {quickStats.map((stat, index) => (
          <div
            key={stat.label}
            className={`glass-card animate-fade-in-up delay-${index + 3}`}
            style={{ padding: "24px" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  {stat.label}
                </p>
                <p className="text-2xl font-bold mt-2" style={{ color: stat.color }}>
                  {loading ? (
                    <span className="skeleton inline-block" style={{ width: "60px", height: "28px" }} />
                  ) : (
                    stat.value
                  )}
                </p>
              </div>
              <div
                className="flex items-center justify-center"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "var(--radius-md)",
                  background: stat.bg,
                  border: `1px solid ${stat.borderColor}`,
                  color: stat.color,
                }}
              >
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
