"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const nav = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </svg>
    ),
  },
  {
    label: "Accounts",
    href: "/dashboard/accounts",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M3 10h18M7 15h2m4 0h2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside
      className="w-[260px] shrink-0 flex flex-col h-screen sticky top-0"
      style={{
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        backdropFilter: "blur(24px) saturate(1.3)",
        WebkitBackdropFilter: "blur(24px) saturate(1.3)",
      }}
    >
      {/* Logo Section */}
      <div className="px-6 pt-7 pb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center animate-pulse-glow"
            style={{
              background: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 50%, #00cec9 100%)",
              boxShadow: "0 4px 20px rgba(108, 92, 231, 0.35)",
            }}
          >
            <svg className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-bold tracking-tight gradient-text">FinanceOS</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
              Premium
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="divider-glow mx-4" />

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-6 space-y-1">
        <p
          className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)" }}
        >
          Navigation
        </p>
        {nav.map(({ label, href, icon }, index) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`animate-slide-in delay-${index + 1}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                fontSize: "0.875rem",
                fontWeight: active ? 600 : 500,
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                color: active ? "var(--accent-primary-light)" : "var(--text-secondary)",
                background: active ? "var(--sidebar-active)" : "transparent",
                border: active ? "1px solid rgba(108, 92, 231, 0.2)" : "1px solid transparent",
                position: "relative",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "var(--glass-hover)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }
              }}
            >
              <span style={{ color: active ? "#a29bfe" : "inherit", transition: "color 0.25s" }}>{icon}</span>
              {label}
              {active && (
                <span
                  className="ml-auto"
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6c5ce7, #00cec9)",
                    boxShadow: "0 0 8px rgba(108, 92, 231, 0.5)",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="divider-glow mx-4" />

      {/* Logout */}
      <div className="px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all cursor-pointer"
          style={{
            color: "var(--text-secondary)",
            background: "transparent",
            border: "1px solid transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 71, 87, 0.08)";
            e.currentTarget.style.color = "#ff6b81";
            e.currentTarget.style.borderColor = "rgba(255, 71, 87, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.borderColor = "transparent";
          }}
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
