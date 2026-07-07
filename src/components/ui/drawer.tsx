"use client";

import React, { useEffect } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { X } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}

export function Drawer({ isOpen, onClose, title, children, width = "max-w-md" }: DrawerProps) {
  const mounted = useHasMounted();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] transition-opacity duration-300 ${
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sliding Panel */}
      <div
        className={`absolute top-0 right-0 h-full w-full ${width} bg-[#0a0a0a] border-l border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[--accent-primary] via-purple-500 to-emerald-500" />
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex flex-col gap-0.5 shrink-0 relative z-10 bg-[#0a0a0a]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[--text-muted] hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[--text-muted]">Data Entry / Actions</p>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 relative z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[--accent-primary]/5 blur-[80px] pointer-events-none" />
          <div className="relative z-10 space-y-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
