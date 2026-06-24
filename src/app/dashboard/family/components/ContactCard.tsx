import React from "react";
import { Edit2, Send, History, Trash2 } from "lucide-react";
import type { Tables } from "@/lib/database.types";

interface ContactCardProps {
  person: Tables<"recipients">;
  totalSent: number;
  onEdit: (person: Tables<"recipients">) => void;
  onSend: (person: Tables<"recipients">) => void;
  onHistory: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ContactCard({
  person,
  totalSent,
  onEdit,
  onSend,
  onHistory,
  onDelete,
}: ContactCardProps) {
  return (
    <div className="glass-card rich-border flex flex-col min-h-[260px] p-6 relative overflow-hidden transition-transform hover:-translate-y-1">
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)" }} />
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[rgba(14,165,233,0.05)] text-[--accent-primary] border border-[rgba(14,165,233,0.1)]">
            {person.relationship || "Family"}
          </span>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-12 h-12 rounded-xl border border-white/5 shadow-inner bg-[rgba(14,165,233,0.05)] text-[--accent-primary] flex items-center justify-center text-xl font-bold">
              {person.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onEdit(person)}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-[--accent-primary-light] hover:border-[--accent-primary]/30 transition-all"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-auto">
        <h3 className="text-lg font-bold truncate min-w-0">{person.name}</h3>
        <p className="text-2xl font-black mt-1 text-[--accent-primary] truncate min-w-0">
          ₹{totalSent.toLocaleString()}
        </p>

        <div className="flex items-center gap-2 mt-6">
          <button
            type="button"
            onClick={() => onSend(person)}
            className="flex-1 min-w-0 h-11 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-[--accent-primary] to-indigo-500 text-white shadow-md shadow-[--accent-primary]/20 hover:shadow-lg hover:shadow-[--accent-primary]/30 hover:-translate-y-0.5 px-2"
          >
            <Send className="w-4 h-4 shrink-0" />
            <span className="truncate min-w-0">Send Funds</span>
          </button>

          <button
            type="button"
            onClick={() => onHistory(person.id)}
            className="w-11 h-11 shrink-0 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center hover:-translate-y-0.5"
            title="History"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(person.id)}
            className="w-11 h-11 shrink-0 rounded-xl bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 hover:text-white transition-all flex items-center justify-center hover:-translate-y-0.5"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
