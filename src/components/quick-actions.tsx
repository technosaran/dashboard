"use client";

import { useState } from "react";
import Link from "next/link";

export default function QuickActions() {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      label: "Record Expense",
      href: "/dashboard/expenses?action=new",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: "bg-rose-500",
    },
    {
      label: "Send Money",
      href: "/dashboard/family",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      ),
      color: "bg-indigo-500",
    },
    {
      label: "Add Account",
      href: "/dashboard/accounts?action=new",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      color: "bg-emerald-500",
    },
  ];

  return (
    <div className="md:hidden fixed bottom-24 right-5 z-[100]">
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[-1]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Action Buttons */}
      <div className={`flex flex-col items-end gap-3 mb-4 transition-all duration-300 ${isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}>
        {actions.map((action, i) => (
          <Link
            key={i}
            href={action.href}
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 group"
          >
            <span className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-white border border-white/10 shadow-xl">
              {action.label}
            </span>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-2xl ${action.color}`}>
              {action.icon}
            </div>
          </Link>
        ))}
      </div>

      {/* Main Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center text-white transition-all duration-500 active:scale-90 ${isOpen ? "bg-rose-500 rotate-45" : "bg-indigo-600 rotate-0"}`}
        style={{
          background: isOpen ? "" : "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)",
          boxShadow: isOpen ? "0 10px 30px rgba(244, 63, 94, 0.4)" : "0 10px 30px rgba(108, 92, 231, 0.4)"
        }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </div>
  );
}
