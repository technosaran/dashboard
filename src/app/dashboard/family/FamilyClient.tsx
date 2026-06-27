"use client";

import { useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { toast } from "react-hot-toast";
import useSWR from "swr";

import { createClient } from "@/lib/supabase-browser";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format } from "date-fns";
import { Edit2, Trash2, Send, Plus, Users, History } from "lucide-react";
import {
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  processFamilyTransfer,
} from "./actions";

/* ── Types ── */
type Member = {
  id: string;
  name: string;
  relationship: string;
  balance: number | string;
  created_at: string;
  user_id: string;
};

type Transfer = {
  id: string;
  family_member_id: string;
  account_id: string;
  amount: number;
  type: string;
  transfer_date: string;
  note: string | null;
  user_id: string;
};

const RELATIONSHIPS = ["Parent", "Spouse", "Child", "Sibling", "Other"];
const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const supabase = createClient();

function getMemberAvatar(name: string, relationship: string): string | null {
  const rel = relationship.toLowerCase();
  const nm = name.toLowerCase();
  if (rel === "parent") {
    if (nm.includes("mother") || nm.includes("mom") || nm.includes("mummy") || nm.includes("maa") || nm.includes("mrs")) {
      return "/avatar_mother.png";
    }
    if (nm.includes("father") || nm.includes("dad") || nm.includes("papa") || nm.includes("daddy") || nm.includes("mr")) {
      return "/avatar_father.png";
    }
    return nm.charCodeAt(0) % 2 === 0 ? "/avatar_mother.png" : "/avatar_father.png";
  }
  if (rel === "spouse") {
    if (nm.includes("wife") || nm.includes("spouse (f)") || nm.includes("her") || nm.includes("mrs")) {
      return "/avatar_mother.png";
    }
    return "/avatar_father.png";
  }
  if (rel === "sibling") {
    if (nm.includes("sister") || nm.includes("didi") || nm.includes("her")) {
      return "/avatar_mother.png";
    }
    if (nm.includes("brother") || nm.includes("bhai") || nm.includes("him")) {
      return "/avatar_father.png";
    }
  }
  return null;
}

export default function FamilyClient() {
  const { data: { accounts, ledgerLogs } = { accounts: [], ledgerLogs: [] }, mutate: mutateFinance } = useFinanceData();
  const searchParams = useSearchParams();
  const mounted = useHasMounted();
  const [submitting, withLock] = useSubmitLock();

  /* ── SWR for family data ── */
  const { data: familyData, mutate } = useSWR("finance_family", async () => {
    const [membersRes, transfersRes] = await Promise.all([
      supabase.from("family_members").select("*").order("created_at", { ascending: false }),
      supabase.from("family_transfers").select("*").order("transfer_date", { ascending: false }),
    ]);
    return {
      members: (membersRes.data ?? []) as Member[],
      transfers: (transfersRes.data ?? []) as Transfer[],
    };
  }, {
    dedupingInterval: 60000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const members = familyData?.members ?? [];
  const transfers = familyData?.transfers ?? [];

  const totalFamilyNetWorth = useMemo(() => {
    return members.reduce((acc, m) => acc + Number(m.balance || 0), 0);
  }, [members]);

  const totalSentThisMonth = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return transfers.reduce((acc, t) => {
      const date = new Date(t.transfer_date);
      if (date >= startOfMonth) {
        return acc + Number(t.amount || 0);
      }
      return acc;
    }, 0);
  }, [transfers]);

  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<"directory" | "history">("directory");
  const [historySearch, setHistorySearch] = useState("");

  /* ── Modal state ── */
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

  /* ── Form state ── */
  const [memberForm, setMemberForm] = useState({ name: "", relationship: "Other" });
  const [transferForm, setTransferForm] = useState({ family_member_id: "", account_id: "", amount: "", note: "" });

  /* ── Auto-open from URL ── */
  useEffect(() => {
    const action = searchParams?.get("action");
    if (action === "new") {
      setTimeout(() => setShowMemberModal(true), 0);
    } else if (action === "send") {
      setTimeout(() => setShowTransferModal(true), 0);
    }
  }, [searchParams]);

  /* ── Pre-fill account defaults ── */
  useEffect(() => {
    if (accounts.length > 0 && !transferForm.account_id) {
      setTimeout(() => setTransferForm(prev => ({ ...prev, account_id: accounts[0].id })), 0);
    }
  }, [accounts, transferForm.account_id]);

  /* ── Helpers ── */
  const getMemberName = useCallback((id: string) => {
    return members.find(m => m.id === id)?.name ?? "Unknown";
  }, [members]);

  const filteredTransfers = useMemo(() => {
    if (!historySearch.trim()) return transfers;
    const q = historySearch.toLowerCase();
    return transfers.filter(t => {
      const memberName = getMemberName(t.family_member_id).toLowerCase();
      const note = (t.note || "").toLowerCase();
      return memberName.includes(q) || note.includes(q);
    });
  }, [transfers, historySearch, getMemberName]);

  const resetMemberForm = () => {
    setMemberForm({ name: "", relationship: "Other" });
    setEditingMember(null);
  };

  const resetTransferForm = () => {
    setTransferForm({ family_member_id: "", account_id: accounts[0]?.id ?? "", amount: "", note: "" });
  };

  /* ── Handlers ── */
  async function handleAddEditMember() {
    await withLock(async () => {
      if (editingMember) {
        const res = await updateFamilyMember(editingMember.id, memberForm);
        if (res.error) { toast.error(res.error); return; }
        toast.success("Member updated");
      } else {
        const res = await addFamilyMember(memberForm);
        if (res.error) { toast.error(res.error); return; }
        toast.success("Member added");
      }
      resetMemberForm();
      setShowMemberModal(false);
      mutate();
      mutateFinance();
    });
  }

  async function handleDeleteMember(id: string) {
    if (!confirm("Delete this family member? This will also remove their transfer history.")) return;
    await withLock(async () => {
      const res = await deleteFamilyMember(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Member deleted");
      mutate();
      mutateFinance();
    });
  }

  async function handleSendMoney() {
    await withLock(async () => {
      const res = await processFamilyTransfer({
        family_member_id: transferForm.family_member_id,
        account_id: transferForm.account_id,
        amount: Number(transferForm.amount),
        type: "gift",
        note: transferForm.note || undefined,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Money sent successfully");
      resetTransferForm();
      setShowTransferModal(false);
      mutate();
      mutateFinance();
    });
  }


  function openEditMember(member: Member) {
    setEditingMember(member);
    setMemberForm({ name: member.name, relationship: member.relationship ?? "Other" });
    setShowMemberModal(true);
  }

  function openSendMoney(memberId?: string) {
    if (memberId) {
      setTransferForm(prev => ({ ...prev, family_member_id: memberId }));
    }
    setShowTransferModal(true);
  }

  if (!mounted) return null;

  const isLoading = !familyData;

  if (isLoading) {
    return (
      <div className="animate-fade-in" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card-static" style={{ height: 120, borderRadius: "var(--radius-xl)" }}>
              <div style={{ padding: "1.5rem", display: "flex", gap: "1rem", alignItems: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg-elevated)", animation: "pulse 2s ease-in-out infinite" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ width: "60%", height: 14, borderRadius: 8, background: "var(--bg-elevated)", animation: "pulse 2s ease-in-out infinite" }} />
                  <div style={{ width: "30%", height: 10, borderRadius: 8, background: "var(--bg-elevated)", animation: "pulse 2s ease-in-out infinite" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in text-[#d1d4dc] max-w-7xl mx-auto w-full px-4 py-6">

      {/* ═══ PAGE HEADER ═══ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase italic">Family Tracker</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.3em] mt-1.5">
            Log and monitor money sent to family members
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="relative bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(147,51,234,0.25)] hover:shadow-[0_0_25px_rgba(147,51,234,0.45)] flex items-center gap-2 active:scale-95 cursor-pointer"
            onClick={() => openSendMoney()}
            disabled={members.length === 0}
          >
            <Send className="w-3.5 h-3.5" />
            Send Money
          </button>
          <button
            className="bg-[#1e1e1e] hover:bg-white/5 text-white border border-white/10 hover:border-white/20 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-2 active:scale-95 cursor-pointer"
            onClick={() => { resetMemberForm(); setShowMemberModal(true); }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Member
          </button>
        </div>
      </div>

      {/* ═══ STATS OVERVIEW ═══ */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total Sent (All Time)", value: totalFamilyNetWorth, color: "text-white" },
          { label: "Sent This Month", value: totalSentThisMonth, color: "text-purple-400" },
          { label: "Active Members", raw: `${members.length} registered`, color: "text-emerald-400" },
        ].map((s, i) => (
          <div key={i} className="glass-card-static p-6 border-white/5 flex flex-col justify-between min-h-[110px]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">{s.label}</p>
            {s.raw ? (
              <p className={`text-2xl font-black tracking-tight ${s.color} mt-3`}>{s.raw}</p>
            ) : (
              <p className={`text-3xl font-black tracking-tight ${s.color} mt-3`}>
                {fmt.format(Number(s.value))}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* ═══ TABS SWITCHER ═══ */}
      <div className="flex p-1 bg-white/[0.02] border border-white/5 rounded-2xl mb-8 max-w-md">
        <button
          onClick={() => setActiveTab("directory")}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "directory"
              ? "bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]"
              : "text-[--text-muted] hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Family Directory
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "history"
              ? "bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]"
              : "text-[--text-muted] hover:text-white hover:bg-white/[0.02]"
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Transfer History
          <span className={`flex h-4 items-center justify-center rounded-full text-[8px] font-black px-1.5 ${
            activeTab === "history" ? "bg-white/20 text-white" : "bg-white/10 text-white"
          }`}>
            {transfers.length}
          </span>
        </button>
      </div>

      {activeTab === "directory" ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {members.length === 0 ? (
            <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[350px] border-white/5">
              <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
              <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/15 to-indigo-600/15 border border-purple-500/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)]">
                  <span className="text-3xl">👥</span>
                </div>
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">No family members registered</h3>
              <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">
                Add family members to keep track of allowances, support, and gifts.
              </p>
              <div className="mt-8 flex justify-center">
                <button onClick={() => { resetMemberForm(); setShowMemberModal(true); }} className="btn-primary">Add Member</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {members.map((member) => {
                const balance = Number(member.balance || 0);
                const initials = member.name.charAt(0).toUpperCase();
                const avatar = getMemberAvatar(member.name, member.relationship);
                return (
                  <div key={member.id} className="glass-card flex flex-col justify-between gap-4 border-white/5 hover:border-purple-500/30 hover:shadow-[0_0_25px_rgba(147,51,234,0.08)] transition-all duration-300 relative group overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="flex items-center gap-4">
                      {avatar ? (
                        <img src={avatar} alt={member.name} className="w-12 h-12 rounded-full object-cover border border-white/10 shadow-[0_0_15px_rgba(255,255,255,0.05)]" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white leading-tight truncate" title={member.name}>{member.name}</h3>
                          <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-md">
                            {member.relationship ?? "Other"}
                          </span>
                        </div>
                        <p className="text-xs text-[--text-muted] mt-1.5">
                          Total Sent: <span className="font-mono font-bold text-white">{fmt.format(balance)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 border-t border-white/5 pt-4 mt-2">
                      <button
                        className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(147,51,234,0.15)] hover:shadow-[0_0_20px_rgba(147,51,234,0.35)] active:scale-95 cursor-pointer"
                        onClick={() => openSendMoney(member.id)}
                      >
                        <Send className="w-3 h-3" />
                        Send Money
                      </button>
                      <button
                        className="bg-[#1e1e1e] hover:bg-white/5 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white px-3.5 py-2.5 rounded-xl text-xs transition-all duration-300 active:scale-95 flex items-center justify-center cursor-pointer"
                        onClick={() => openEditMember(member)}
                        title="Edit member"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 hover:border-rose-600 text-rose-400 hover:text-white px-3.5 py-2.5 rounded-xl text-xs transition-all duration-300 active:scale-95 flex items-center justify-center cursor-pointer"
                        onClick={() => handleDeleteMember(member.id)}
                        disabled={submitting}
                        title="Delete member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass-card-static rounded-2xl overflow-hidden border border-white/5">
            <div className="p-4 md:p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02]">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  placeholder="Search transfers..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="input-premium pl-9 py-2 text-sm w-full sm:w-64 !bg-black/20"
                />
              </div>
              <p className="text-[10px] font-black text-[--text-muted] uppercase tracking-widest">{filteredTransfers.length} Records</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] text-[--text-muted] uppercase font-black tracking-widest bg-black/40">
                    <th className="py-4 px-6">Date</th>
                    <th className="py-4 px-6">Recipient</th>
                    <th className="py-4 px-6">From Account</th>
                    <th className="py-4 px-6">Note</th>
                    <th className="py-4 px-6 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTransfers.map((tr) => {
                    const memberName = getMemberName(tr.family_member_id);
                    const accountName = accounts.find(a => a.id === tr.account_id)?.name || "Unknown Account";

                    return (
                      <tr key={tr.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-6 text-[12px] font-bold text-white/80">
                          {tr.transfer_date ? format(new Date(tr.transfer_date), "MMM d, yyyy") : "N/A"}
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-[12px] font-bold text-white">{memberName}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-[12px] font-medium text-[--text-secondary]">{accountName}</span>
                        </td>
                        <td className="py-4 px-6 max-w-xs truncate">
                          <span className="text-[12px] text-[--text-muted]" title={tr.note || ""}>{tr.note || "—"}</span>
                        </td>
                        <td className="py-4 px-6 text-right tabular-nums">
                          <span className="text-[13px] font-black text-rose-400">
                            -{fmt.format(Number(tr.amount))}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTransfers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[11px] font-bold text-[--text-muted] uppercase tracking-[0.3em]">
                        No historical records detected
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Add/Edit Member Modal */}
      {showMemberModal && (
        <ModalOverlay onClose={() => { setShowMemberModal(false); resetMemberForm(); }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: "0 0 1.25rem" }}>
            {editingMember ? "Edit Member" : "Add Family Member"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input
                className="input-premium"
                placeholder="Enter name"
                value={memberForm.name}
                onChange={e => setMemberForm(prev => ({ ...prev, name: e.target.value }))}
                autoFocus
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Relationship</label>
              <select
                className="input-premium"
                value={memberForm.relationship}
                onChange={e => setMemberForm(prev => ({ ...prev, relationship: e.target.value }))}
                style={{ width: "100%" }}
              >
                {RELATIONSHIPS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button className="btn-primary" onClick={handleAddEditMember} disabled={submitting || !memberForm.name.trim()} style={{ flex: 1, fontWeight: 800 }}>
                {submitting ? "Saving..." : editingMember ? "Update" : "Add Member"}
              </button>
              <button className="btn-secondary" onClick={() => { setShowMemberModal(false); resetMemberForm(); }} style={{ fontWeight: 700 }}>
                Cancel
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Send Money Modal */}
      {showTransferModal && (
        <ModalOverlay onClose={() => { setShowTransferModal(false); resetTransferForm(); }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: "0 0 1.25rem" }}>
            💸 Send Money
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Family Member</label>
              <select
                className="input-premium"
                value={transferForm.family_member_id}
                onChange={e => setTransferForm(prev => ({ ...prev, family_member_id: e.target.value }))}
                style={{ width: "100%" }}
              >
                <option value="">Select member</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>From Account</label>
              <select
                className="input-premium"
                value={transferForm.account_id}
                onChange={e => setTransferForm(prev => ({ ...prev, account_id: e.target.value }))}
                style={{ width: "100%" }}
              >
                <option value="">Select account</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({fmt.format(Number(a.balance))})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Amount</label>
              <input
                className="input-premium"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={transferForm.amount}
                onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Note <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></label>
              <input
                className="input-premium"
                placeholder="E.g., pocket money, birthday gift..."
                value={transferForm.note}
                onChange={e => setTransferForm(prev => ({ ...prev, note: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                className="btn-success"
                onClick={handleSendMoney}
                disabled={submitting || !transferForm.family_member_id || !transferForm.account_id || !transferForm.amount}
                style={{ flex: 1, fontWeight: 800 }}
              >
                {submitting ? "Sending..." : "Send Money"}
              </button>
              <button className="btn-secondary" onClick={() => { setShowTransferModal(false); resetTransferForm(); }} style={{ fontWeight: 700 }}>
                Cancel
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* ── Modal Overlay Component ── */
function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="animate-fade-in"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: "1rem",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass-card-static animate-scale-in"
        style={{
          width: "100%",
          maxWidth: 440,
          borderRadius: "var(--radius-xl)",
          padding: "1.75rem",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Shared label styles ── */
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--text-muted)",
  marginBottom: 6,
};
