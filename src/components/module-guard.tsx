"use client";

import React from "react";
import Link from "next/link";
import { useFinanceData } from "@/hooks/use-finance-data";
import { MODULE_DISPLAY_LABELS } from "@/lib/modules";
import type { ModuleKey } from "@/lib/modules";
import { EmptyState } from "./empty-state";

interface ModuleGuardProps {
  moduleKey: ModuleKey;
  children: React.ReactNode;
}

export function ModuleGuard({ moduleKey, children }: ModuleGuardProps) {
  const { data: { profile } = {}, isLoading } = useFinanceData();

  if (isLoading) {
    return null; 
  }

  const enabledModules = profile?.settings?.enabled_modules;
  const isEnabled = !enabledModules || enabledModules.includes(moduleKey);

  if (!isEnabled) {
    const displayName = MODULE_DISPLAY_LABELS[moduleKey] || moduleKey;
    return (
      <div className="py-12 max-w-4xl mx-auto animate-fade-in">
        <EmptyState
          title={`${displayName} Module is Disabled`}
          description={`The ${displayName.toLowerCase()} features are currently hidden. You can enable them anytime under your Profile settings.`}
          glowColor="indigo"
          icon="🔒"
          action={
            <Link
              href="/dashboard/settings"
              className="btn-primary px-6 h-11 flex items-center justify-center font-bold no-underline rounded-xl bg-gradient-to-r from-[--accent-primary] to-indigo-500 text-white shadow-lg shadow-indigo-500/20"
            >
              Configure settings
            </Link>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
