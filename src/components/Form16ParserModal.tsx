"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { X, Upload, FileText, CheckCircle } from "lucide-react";

interface Form16Data {
  grossSalary: number;
  allowancesExempt: number;
  standardDeduction: number;
  deductions80C: number;
  deductions80D: number;
  tdsPaid: number;
}

interface Form16ParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: Form16Data) => void;
}

export default function Form16ParserModal({
  isOpen,
  onClose,
  onApply,
}: Form16ParserModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<Form16Data | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    let textToParse = rawText.trim();

    if (selectedFile && !textToParse) {
      try {
        textToParse = await selectedFile.text();
      } catch {
        toast.error("Failed to read text from selected file.");
        return;
      }
    }

    if (!selectedFile && !textToParse) {
      toast.error("Please upload Form 16 PDF file or paste Form 16 Part-B statement text.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/form16-parser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToParse }),
      });

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to parse Form 16");

      setExtracted(json.data);
      toast.success("Form 16 Part-B extracted successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse Form 16");
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToTax = () => {
    if (extracted) {
      onApply(extracted);
      toast.success("Form 16 values applied to Tax Studio!");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-card p-6 md:p-8 rounded-3xl max-w-lg w-full border border-cyan-500/30 bg-slate-900/95 space-y-6 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white tracking-tight">Form 16 Part-B PDF Parser</h3>
            <p className="text-xs text-gray-400">Auto-extract Salary, Standard Deduction, 80C & TDS</p>
          </div>
        </div>

        {!extracted ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-300 block mb-2">Upload Form 16 PDF / Text File</label>
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 cursor-pointer mb-3"
              />
              {selectedFile && (
                <p className="text-[11px] text-cyan-400 font-mono mb-2">Selected file: {selectedFile.name}</p>
              )}
              <label className="text-xs font-bold text-gray-300 block mb-2">Or Paste Form 16 Text</label>
              <textarea
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste Form 16 Part-B statement text here (e.g. Gross Salary, Section 10, Standard Deduction, Section 80C, Section 192 TDS)..."
                className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <button
              type="button"
              onClick={handleParse}
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-cyan-500/20"
            >
              <Upload className="w-4 h-4" />
              <span>{loading ? "Extracting Form 16..." : "Extract Form 16 Part-B"}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 text-xs font-mono">
              <div className="flex justify-between"><span className="text-gray-400">Gross Salary u/s 17(1)</span><span className="font-bold text-white">₹{extracted.grossSalary.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Standard Deduction u/s 16(ia)</span><span className="font-bold text-rose-400">₹{extracted.standardDeduction.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Section 80C Deduction</span><span className="font-bold text-cyan-300">₹{extracted.deductions80C.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Section 80D Deduction</span><span className="font-bold text-cyan-300">₹{extracted.deductions80D.toLocaleString()}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-gray-300 font-bold">TDS Paid u/s 192</span><span className="font-bold text-emerald-400">₹{extracted.tdsPaid.toLocaleString()}</span></div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setExtracted(null)}
                className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-xs font-bold text-gray-300 hover:text-white"
              >
                Re-Parse
              </button>
              <button
                type="button"
                onClick={handleApplyToTax}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Apply to Tax Studio</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
