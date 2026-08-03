"use client";

import { useState } from "react";
import { FileText, FileCheck, ArrowRight, ShieldCheck, Download } from "lucide-react";
import BankStatementParserModal from "@/components/BankStatementParserModal";
import CASImportModal from "@/components/CASImportModal";
import type { Tables } from "@/lib/database.types";

type Account = Tables<"accounts">;

interface ImportsTabProps {
  accounts: Account[];
  mutate: () => void;
}

export default function ImportsTab({ accounts, mutate }: ImportsTabProps) {
  const [showBankModal, setShowBankModal] = useState(false);
  const [showCASModal, setShowCASModal] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Download className="w-5 h-5 text-sky-400 shrink-0" /> Data Imports & Statement Parsers
        </h2>
        <p className="text-xs text-[--text-secondary]">
          Import bank PDF statements, CAMS/NSDL mutual fund statements, and stock portfolio holdings from one central hub.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bank PDF Parser Card */}
        <div className="glass-card rich-border p-6 rounded-2xl flex flex-col justify-between border border-sky-500/20 bg-gradient-to-br from-sky-950/20 via-slate-900/40 to-slate-950/60 relative overflow-hidden group hover:border-sky-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all" />

          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[0.6875rem] font-black uppercase tracking-wider bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  Bank Parser
                </span>
                <h3 className="text-lg font-bold text-white mt-1">Bank Statement PDF Parser</h3>
              </div>
            </div>

            <p className="text-xs text-[--text-secondary] leading-relaxed mb-6">
              Auto-extract transactions from ICICI, HDFC, SBI, Axis, and generic bank PDF statements. Supports encrypted PDFs with password decryption and auto-categorization.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[0.6875rem] font-semibold text-sky-400/80">
              <ShieldCheck className="w-4 h-4" />
              <span>Supports Password-Protected PDFs & Text Paste</span>
            </div>

            <button
              type="button"
              onClick={() => setShowBankModal(true)}
              className="w-full py-3 px-4 rounded-xl bg-sky-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-sky-500/25 hover:bg-sky-400 hover:shadow-sky-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Launch Bank Parser</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CAMS / NSDL CAS Parser Card */}
        <div className="glass-card rich-border p-6 rounded-2xl flex flex-col justify-between border border-purple-500/20 bg-gradient-to-br from-purple-950/20 via-slate-900/40 to-slate-950/60 relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />

          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[0.6875rem] font-black uppercase tracking-wider bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  CAS Portfolio Parser
                </span>
                <h3 className="text-lg font-bold text-white mt-1">CAMS / NSDL CAS Parser</h3>
              </div>
            </div>

            <p className="text-xs text-[--text-secondary] leading-relaxed mb-6">
              Bulk import all your Mutual Funds & Stock holdings directly from CAMS, KFintech, CDSL, or NSDL Consolidated Account Statements (CAS).
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[0.6875rem] font-semibold text-purple-400/80">
              <ShieldCheck className="w-4 h-4" />
              <span>Supports Encrypted CAS PDFs & CSV Statements</span>
            </div>

            <button
              type="button"
              onClick={() => setShowCASModal(true)}
              className="w-full py-3 px-4 rounded-xl bg-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-500/25 hover:bg-purple-400 hover:shadow-purple-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Launch CAS Parser</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <BankStatementParserModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        accounts={accounts}
        onSuccess={() => mutate()}
      />

      <CASImportModal
        isOpen={showCASModal}
        onClose={() => setShowCASModal(false)}
        onSuccess={() => mutate()}
      />
    </div>
  );
}
