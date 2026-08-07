"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/user-context";
import { createClient } from "@/lib/supabase-browser";
import { ShieldAlert, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface AdminGuardProps {
  children: React.ReactNode;
}

export const SUPER_ADMIN_EMAIL = "iamsaran.ai@gmail.com";

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading: userLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdminStatus() {
      if (userLoading) return;

      if (!user) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }

      // Explicit Super Admin Email Restriction
      const userEmail = (user.email || "").toLowerCase().trim();
      const isSuperAdminEmail = userEmail === SUPER_ADMIN_EMAIL.toLowerCase();

      // 1. Check if email matches designated Super Admin email
      if (isSuperAdminEmail) {
        setIsAdmin(true);
        setChecking(false);
        return;
      }

      // 2. Check user metadata
      const metaRole = user.user_metadata?.role;
      const metaIsAdmin = user.user_metadata?.is_admin;
      if ((metaRole === "admin" || metaRole === "superadmin" || metaIsAdmin === true) && isSuperAdminEmail) {
        setIsAdmin(true);
        setChecking(false);
        return;
      }

      // 3. Check public.profiles table
      try {
        const supabase = createClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        const profAny = profile as any;
        if (profAny && (profAny.is_admin === true || profAny.role === "admin") && isSuperAdminEmail) {
          setIsAdmin(true);
          setChecking(false);
          return;
        }
      } catch (err) {
        console.warn("Admin profile check error:", err);
      }

      // Strictly deny access for any other email
      setIsAdmin(false);
      setChecking(false);
    }

    void checkAdminStatus();
  }, [user, userLoading]);

  if (userLoading || checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 text-center space-y-3">
          <div className="w-8 h-8 mx-auto animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-xs font-bold text-gray-400">Verifying Super Admin Authorization...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 rounded-3xl bg-slate-900/90 border border-rose-500/30 text-center space-y-6 shadow-2xl animate-fade-in">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-black uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>403 Access Denied</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Developer & Super Admin Studio Only
          </h2>
          <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
            This module is restricted to system administrators. Regular user accounts do not have permission to view or modify developer controls.
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Personal Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
