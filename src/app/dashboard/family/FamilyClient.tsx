"use client";

import { useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useHasMounted } from "@/hooks/use-has-mounted";
import { toast } from "react-hot-toast";
import useSWR from "swr";

import { createClient } from "@/lib/supabase-browser";
import { useFinanceData } from "@/hooks/use-finance-data";
import { useSubmitLock } from "@/hooks/use-submit-lock";
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

export default function FamilyClient() {
  const { data: { accounts } = { accounts: [] }, mutate: mutateFinance } = useFinanceData();
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
      setShowMemberModal(true);
    } else if (action === "send") {
      setShowTransferModal(true);
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
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded text-xs font-bold transition-colors shadow-md flex items-center gap-1.5"
            onClick={() => openSendMoney()}
            disabled={members.length === 0}
          >
            💸 Send Money
          </button>
          <button
            className="bg-white/10 hover:bg-white/15 text-white border border-white/10 px-4 py-2 rounded text-xs font-bold transition-colors shadow-md flex items-center gap-1.5"
            onClick={() => { resetMemberForm(); setShowMemberModal(true); }}
          >
            <span className="text-sm">+</span> Add Member
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
          <div key={i} className="p-5 rounded border border-white/10 bg-[#151515] flex flex-col justify-between min-h-[90px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{s.label}</p>
            {s.raw ? (
              <p className={`text-xl font-bold tracking-tight ${s.color} mt-2`}>{s.raw}</p>
            ) : (
              <p className={`text-2xl font-bold tracking-tight ${s.color} mt-2`}>
                {fmt.format(Number(s.value))}
              </p>
            )}
          </div>
        ))}
      </section>

      {/* ═══ TWO-COLUMN CONTENT LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Family Directory Column (2/3 width on large) */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Family Directory</h2>
          </div>

          {members.length === 0 ? (
            <div className="p-8 rounded border border-dashed border-white/10 bg-[#151515] text-center">
              <p className="text-xs text-gray-500">No family members set up yet. Click &quot;Add Member&quot; to begin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {members.map((member) => {
                const balance = Number(member.balance || 0);
                const initials = member.name.charAt(0).toUpperCase();
                return (
                  <div key={member.id} className="p-4 rounded border border-white/10 bg-[#151515] flex flex-col justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white leading-tight truncate">{member.name}</h3>
                          <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                            {member.relationship ?? "Other"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Total Sent: <span className="font-bold text-white">{fmt.format(balance)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 border-t border-white/5 pt-3">
                      <button
                        className="flex-1 bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white py-1.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1 border border-purple-500/10"
                        onClick={() => openSendMoney(member.id)}
                      >
                        💸 Send Money
                      </button>
                      <button
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white px-2.5 py-1.5 rounded text-xs transition-colors"
                        onClick={() => openEditMember(member)}
                        title="Edit member"
                      >
                        ✏️
                      </button>
                      <button
                        className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 px-2.5 py-1.5 rounded text-xs transition-colors"
                        onClick={() => handleDeleteMember(member.id)}
                        disabled={submitting}
                        title="Delete member"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Transfer Log Column (1/3 width on large) */}
        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Recent Transfers</h2>

          {transfers.length === 0 ? (
            <div className="p-8 rounded border border-dashed border-white/10 bg-[#151515] text-center">
              <p className="text-xs text-gray-500">No transfers logged yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {transfers.slice(0, 10).map((tr) => (
                <div key={tr.id} className="p-3.5 rounded border border-white/5 bg-[#121212] flex flex-col gap-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-white">{getMemberName(tr.family_member_id)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {tr.transfer_date ? new Date(tr.transfer_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </p>
                    </div>
                    <span className="text-xs font-black text-rose-400 tabular-nums">
                      -{fmt.format(Number(tr.amount))}
                    </span>
                  </div>
                  {tr.note && (
                    <p className="text-[10px] text-gray-400 bg-white/5 p-1.5 rounded border border-white/5 leading-relaxed">
                      {tr.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

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
