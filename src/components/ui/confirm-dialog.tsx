"use client";

import React, { useEffect } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "primary";
  loading?: boolean;
  /** Optional extra content rendered between description and buttons */
  children?: React.ReactNode;
}

const VARIANT_STYLES = {
  danger: {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    iconBg: "bg-rose-500/15 border-rose-500/25 text-rose-400",
    btn: "bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20",
  },
  warning: {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    iconBg: "bg-amber-500/15 border-amber-500/25 text-amber-400",
    btn: "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20",
  },
  primary: {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: "bg-[--accent-primary]/15 border-[--accent-primary]/25 text-[--accent-primary-light]",
    btn: "bg-[--accent-primary] hover:bg-[--accent-primary-light] text-white shadow-[--accent-primary]/20",
  },
} as const;

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  children,
}: ConfirmDialogProps) {
  const mounted = useHasMounted();
  const styles = VARIANT_STYLES[variant];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card-static w-full max-w-sm p-8 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${styles.iconBg}`}>
            {styles.icon}
          </div>
          <div>
            <h3 id="confirm-dialog-title" className="text-xl font-black text-[--text-primary]">
              {title}
            </h3>
            <div className="text-sm text-[--text-secondary] mt-2 leading-relaxed">
              {description}
            </div>
          </div>
          {children}
          <div className="flex gap-3 w-full mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary flex-1 h-11 font-bold rounded-xl"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 h-11 font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${styles.btn}`}
            >
              {loading ? "Processing..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
