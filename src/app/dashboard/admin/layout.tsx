import React from "react";

export const metadata = {
  title: "Super Admin Command Console | FinanceOS",
  description: "Standalone Super Admin Control Studio for System Health, AI Tax Laws, and Security Audit",
};

export default function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07090e] text-white selection:bg-amber-500/30 selection:text-amber-200">
      {children}
    </div>
  );
}
