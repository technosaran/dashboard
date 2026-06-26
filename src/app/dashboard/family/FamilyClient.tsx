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
  createAllowance,
  deleteAllowance,
  processFamilyTransfer,
  payAllowance,
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

type Allowance = {
  id: string;
  family_member_id: string;
  amount: number;
  frequency: string;
  last_paid_at: string | null;
  user_id: string;
  created_at: string;
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
const FREQUENCIES = ["daily", "weekly", "monthly"];

const MEMBER_GRADIENTS = [
  "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(168,85,247,0.06) 100%)",
  "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(52,211,153,0.06) 100%)",
  "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(251,191,36,0.06) 100%)",
  "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(244,114,182,0.06) 100%)",
  "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(96,165,250,0.06) 100%)",
  "linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(45,212,191,0.06) 100%)",
];

const RELATIONSHIP_BADGES: Record<string, string> = {
  Parent: "badge-info",
  Spouse: "badge-success",
  Child: "badge-warning",
  Sibling: "badge-info",
  Other: "badge",
};

const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

const supabase = createClient();

export default function FamilyClient() {
  const { data: { accounts } = { accounts: [] }, mutate: mutateFinance } = useFinanceData();
  const searchParams = useSearchParams();
  const mounted = useHasMounted();
  const [submitting, withLock] = useSubmitLock();

  /* ── SWR for family data ── */
  const { data: familyData, mutate } = useSWR("finance_family", async () => {
    const [membersRes, allowancesRes, transfersRes] = await Promise.all([
      supabase.from("family_members").select("*").order("created_at", { ascending: false }),
      supabase.from("family_allowances").select("*").order("created_at", { ascending: false }),
      supabase.from("family_transfers").select("*").order("transfer_date", { ascending: false }),
    ]);
    return {
      members: (membersRes.data ?? []) as Member[],
      allowances: (allowancesRes.data ?? []) as Allowance[],
      transfers: (transfersRes.data ?? []) as Transfer[],
    };
  }, {
    dedupingInterval: 60000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const members = familyData?.members ?? [];
  const allowances = familyData?.allowances ?? [];
  const transfers = familyData?.transfers ?? [];

  /* ── Modal state ── */
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showAllowanceModal, setShowAllowanceModal] = useState(false);
  const [showPayAllowanceModal, setShowPayAllowanceModal] = useState(false);
  
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [payingAllowance, setPayingAllowance] = useState<Allowance | null>(null);

  /* ── Form state ── */
  const [memberForm, setMemberForm] = useState({ name: "", relationship: "Other" });
  const [transferForm, setTransferForm] = useState({ family_member_id: "", account_id: "", amount: "", note: "" });
  const [allowanceForm, setAllowanceForm] = useState({ family_member_id: "", amount: "", frequency: "monthly" });
  const [payAllowanceForm, setPayAllowanceForm] = useState({ account_id: "" });

  /* ── Auto-open from URL ── */
  useEffect(() => {
    if (searchParams?.get("action") === "new") {
      setShowMemberModal(true);
    }
  }, [searchParams]);

  /* ── Pre-fill account defaults ── */
  useEffect(() => {
    if (accounts.length > 0 && !transferForm.account_id) {
      setTimeout(() => setTransferForm(prev => ({ ...prev, account_id: accounts[0].id })), 0);
    }
  }, [accounts, transferForm.account_id]);

  useEffect(() => {
    if (accounts.length > 0 && !payAllowanceForm.account_id) {
      setTimeout(() => setPayAllowanceForm({ account_id: accounts[0].id }), 0);
    }
  }, [accounts, payAllowanceForm.account_id]);

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

  const resetAllowanceForm = () => {
    setAllowanceForm({ family_member_id: "", amount: "", frequency: "monthly" });
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
    if (!confirm("Delete this family member? This will also remove related allowances and transfers.")) return;
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
      toast.success("Transfer sent");
      resetTransferForm();
      setShowTransferModal(false);
      mutate();
      mutateFinance();
    });
  }

  async function handleCreateAllowance() {
    await withLock(async () => {
      const res = await createAllowance({
        family_member_id: allowanceForm.family_member_id,
        amount: Number(allowanceForm.amount),
        frequency: allowanceForm.frequency,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Allowance created");
      resetAllowanceForm();
      setShowAllowanceModal(false);
      mutate();
    });
  }

  async function handleDeleteAllowance(id: string) {
    if (!confirm("Delete this allowance?")) return;
    await withLock(async () => {
      const res = await deleteAllowance(id);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Allowance deleted");
      mutate();
    });
  }

  async function handlePayAllowanceSubmit() {
    if (!payingAllowance) return;
    await withLock(async () => {
      const res = await payAllowance({
        allowance_id: payingAllowance.id,
        account_id: payAllowanceForm.account_id,
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Allowance paid");
      setPayingAllowance(null);
      setShowPayAllowanceModal(false);
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

  function openPayAllowance(allowance: Allowance) {
    setPayingAllowance(allowance);
    if (accounts.length > 0) {
      setPayAllowanceForm({ account_id: accounts[0].id });
    }
    setShowPayAllowanceModal(true);
  }

  if (!mounted) return null;

  const isLoading = !familyData;

  /* ── Loading state ── */
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
    <div className="animate-fade-in" style={{ padding: "1rem 1rem 6rem", maxWidth: 1200, margin: "0 auto" }}>

      {/* ═══ PAGE HEADER ═══ */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "2rem" }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 900, letterSpacing: "-0.03em", margin: 0 }}>
            Family Management
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "0.25rem 0 0", letterSpacing: "-0.01em" }}>
            Manage members, allowances &amp; transfers
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { resetMemberForm(); setShowMemberModal(true); }}
          style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}
        >
          <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Add Member
        </button>
      </div>

      {/* ═══ MEMBERS GRID ═══ */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", textTransform: "uppercase", marginBottom: "1rem", opacity: 0.7 }}>
          Family Members
        </h2>

        {members.length === 0 ? (
          <div className="glass-card-static animate-scale-in" style={{ borderRadius: "var(--radius-xl)", padding: "3rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👨‍👩‍👧‍👦</div>
            <p style={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: 15, margin: "0 0 4px" }}>No family members yet</p>
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Add your first member to start managing family finances</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
            {members.map((member, idx) => {
              const balance = Number(member.balance || 0);
              const badgeClass = RELATIONSHIP_BADGES[member.relationship ?? "Other"] ?? "badge";
              return (
                <div
                  key={member.id}
                  className="glass-card animate-scale-in"
                  style={{
                    borderRadius: "var(--radius-xl)",
                    padding: "1.25rem 1.5rem",
                    background: MEMBER_GRADIENTS[idx % MEMBER_GRADIENTS.length],
                    animationDelay: `${idx * 60}ms`,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Decorative circle */}
                  <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "var(--accent-primary)", opacity: 0.04 }} />

                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                    {/* Avatar */}
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--accent-primary), rgba(168,85,247,0.8))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 900, fontSize: 16, letterSpacing: "-0.03em",
                      boxShadow: "0 4px 12px rgba(99,102,241,0.25)",
                    }}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-primary)", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {member.name}
                      </div>
                      <span className={badgeClass} style={{ fontSize: 10, marginTop: 2, display: "inline-block" }}>
                        {member.relationship ?? "Other"}
                      </span>
                    </div>
                  </div>

                  {/* Balance */}
                  <div style={{ marginBottom: "1rem" }}>
                    <div style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>Current Balance</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
                      {fmt.format(balance)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn-success"
                      onClick={() => openSendMoney(member.id)}
                      style={{ flex: 1, fontSize: 11, padding: "8px 10px", fontWeight: 700 }}
                    >
                      💸 Send
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => openEditMember(member)}
                      style={{ fontSize: 11, padding: "8px 12px", fontWeight: 700 }}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleDeleteMember(member.id)}
                      disabled={submitting}
                      style={{ fontSize: 11, padding: "8px 12px", fontWeight: 700 }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══ ALLOWANCES SECTION ═══ */}
      <section style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", textTransform: "uppercase", opacity: 0.7, margin: 0 }}>
            Allowances
          </h2>
          <button
            className="btn-secondary"
            onClick={() => { resetAllowanceForm(); setShowAllowanceModal(true); }}
            disabled={members.length === 0}
            style={{ fontSize: 11, padding: "8px 14px", fontWeight: 700 }}
          >
            + Add Allowance
          </button>
        </div>

        {allowances.length === 0 ? (
          <div className="glass-card-static animate-scale-in" style={{ borderRadius: "var(--radius-xl)", padding: "2.5rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📅</div>
            <p style={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: 14, margin: "0 0 4px" }}>No allowances set</p>
            <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>Create recurring allowances for family members</p>
          </div>
        ) : (
          <div className="glass-card-static" style={{ borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                    {["Member", "Amount", "Frequency", "Last Paid", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allowances.map(al => (
                    <tr key={al.id} style={{ borderBottom: "1px solid var(--border-default)" }} className="animate-fade-in">
                      <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                        {getMemberName(al.family_member_id)}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: 14, color: "var(--success)" }}>
                        {fmt.format(Number(al.amount))}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className="badge-info" style={{ fontSize: 10, textTransform: "capitalize" }}>{al.frequency}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)" }}>
                        {al.last_paid_at ? new Date(al.last_paid_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Never"}
                      </td>
                      <td style={{ padding: "12px 16px", display: "flex", gap: 6 }}>
                        <button
                          className="btn-success"
                          onClick={() => openPayAllowance(al)}
                          disabled={submitting}
                          style={{ fontSize: 10, padding: "6px 12px", fontWeight: 700 }}
                        >
                          Pay Now
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() => handleDeleteAllowance(al.id)}
                          disabled={submitting}
                          style={{ fontSize: 10, padding: "6px 12px", fontWeight: 700 }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ═══ RECENT TRANSFERS ═══ */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em", textTransform: "uppercase", marginBottom: "1rem", opacity: 0.7 }}>
          Recent Transfers
        </h2>

        {transfers.length === 0 ? (
          <div className="glass-card-static animate-scale-in" style={{ borderRadius: "var(--radius-xl)", padding: "2.5rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>💱</div>
            <p style={{ color: "var(--text-secondary)", fontWeight: 600, fontSize: 14, margin: "0 0 4px" }}>No transfers yet</p>
            <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>Send money to family members to see transfers here</p>
          </div>
        ) : (
          <div className="glass-card-static" style={{ borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                    {["Date", "Member", "Amount", "Type", "Note"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transfers.slice(0, 25).map(tr => (
                    <tr key={tr.id} style={{ borderBottom: "1px solid var(--border-default)" }} className="animate-fade-in">
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {tr.transfer_date ? new Date(tr.transfer_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>
                        {getMemberName(tr.family_member_id)}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: 14, color: "var(--danger)" }}>
                        {fmt.format(Number(tr.amount))}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className={tr.type === "allowance" ? "badge-warning" : "badge-info"} style={{ fontSize: 10, textTransform: "capitalize" }}>
                          {tr.type ?? "one-off"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tr.note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ═══ MODALS ═══ */}

      {/* ── Add/Edit Member Modal ── */}
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

      {/* ── Send Money Modal ── */}
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

      {/* ── Add Allowance Modal ── */}
      {showAllowanceModal && (
        <ModalOverlay onClose={() => { setShowAllowanceModal(false); resetAllowanceForm(); }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: "0 0 1.25rem" }}>
            📅 Add Allowance
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>Family Member</label>
              <select
                className="input-premium"
                value={allowanceForm.family_member_id}
                onChange={e => setAllowanceForm(prev => ({ ...prev, family_member_id: e.target.value }))}
                style={{ width: "100%" }}
              >
                <option value="">Select member</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
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
                value={allowanceForm.amount}
                onChange={e => setAllowanceForm(prev => ({ ...prev, amount: e.target.value }))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={labelStyle}>Frequency</label>
              <select
                className="input-premium"
                value={allowanceForm.frequency}
                onChange={e => setAllowanceForm(prev => ({ ...prev, frequency: e.target.value }))}
                style={{ width: "100%" }}
              >
                {FREQUENCIES.map(f => (
                  <option key={f} value={f} style={{ textTransform: "capitalize" }}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                className="btn-primary"
                onClick={handleCreateAllowance}
                disabled={submitting || !allowanceForm.family_member_id || !allowanceForm.amount}
                style={{ flex: 1, fontWeight: 800 }}
              >
                {submitting ? "Creating..." : "Create Allowance"}
              </button>
              <button className="btn-secondary" onClick={() => { setShowAllowanceModal(false); resetAllowanceForm(); }} style={{ fontWeight: 700 }}>
                Cancel
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Pay Allowance Confirm Modal ── */}
      {showPayAllowanceModal && payingAllowance && (
        <ModalOverlay onClose={() => { setShowPayAllowanceModal(false); setPayingAllowance(null); }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: "0 0 1.25rem" }}>
            💳 Pay Allowance
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: "1.5", marginBottom: "1rem" }}>
            Confirm paying the allowance of <strong>{fmt.format(payingAllowance.amount)}</strong> ({payingAllowance.frequency}) to <strong>{getMemberName(payingAllowance.family_member_id)}</strong>?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={labelStyle}>From Account</label>
              <select
                className="input-premium"
                value={payAllowanceForm.account_id}
                onChange={e => setPayAllowanceForm({ account_id: e.target.value })}
                style={{ width: "100%" }}
              >
                <option value="">Select account</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({fmt.format(Number(a.balance))})</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                className="btn-success"
                onClick={handlePayAllowanceSubmit}
                disabled={submitting || !payAllowanceForm.account_id}
                style={{ flex: 1, fontWeight: 800 }}
              >
                {submitting ? "Processing..." : "Confirm Payment"}
              </button>
              <button
                className="btn-secondary"
                onClick={() => { setShowPayAllowanceModal(false); setPayingAllowance(null); }}
                style={{ fontWeight: 700 }}
              >
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
