"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import { createRecipient, deleteRecipient, sendMoneyToFamily } from "./actions";
import { getAccounts } from "../accounts/actions";
import { toast } from "react-hot-toast";

const supabase = createClient();

type Recipient = {
  id: string;
  name: string;
  relationship: string | null;
  account_number: string | null;
  bank_name: string | null;
  created_at: string;
};

type Account = {
  id: string;
  name: string;
  balance: number;
  currency: string;
};

type SendHistory = {
  id: string;
  created_at: string;
  details: string | null;
  amount: number | null;
  action_type: string;
};

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

const RELATIONSHIP_CONFIG: Record<string, { gradient: string; emoji: string; color: string }> = {
  Family:  { gradient: "linear-gradient(135deg, #6c5ce7, #a29bfe)", emoji: "👨‍👩‍👧‍👦", color: "#a29bfe" },
  Friend:  { gradient: "linear-gradient(135deg, #00cec9, #55efc4)", emoji: "🤝",       color: "#55efc4" },
  Other:   { gradient: "linear-gradient(135deg, #fd79a8, #fdcb6e)", emoji: "👤",       color: "#fdcb6e" },
};

export default function FamilyPage() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [isSendingMoney, setIsSendingMoney] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [recentSends, setRecentSends] = useState<SendHistory[]>([]);
  const [sending, setSending] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("All");

  // Form states
  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] = useState("Family");
  const [newAccountNumber, setNewAccountNumber] = useState("");
  const [newBankName, setNewBankName] = useState("");

  const [sendAmount, setSendAmount] = useState("");
  const [sendAccountId, setSendAccountId] = useState("");
  const [sendNote, setSendNote] = useState("");

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [recipRes, accRes, historyRes] = await Promise.all([
      supabase.from("recipients").select("*").eq("user_id", user.id).order("name"),
      getAccounts(),
      supabase
        .from("ledger_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("action_type", "SEND_MONEY")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (recipRes.data) setRecipients(recipRes.data as Recipient[]);
    if (accRes.data) setAccounts(accRes.data as Account[]);
    if (historyRes.data) setRecentSends(historyRes.data as SendHistory[]);

    if (accRes.data && accRes.data.length > 0) {
      setSendAccountId(accRes.data[0].id);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    startTransition(fetchData);
  }, [fetchData]);

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await createRecipient({
      name: newName,
      relationship: newRelationship,
      account_number: newAccountNumber || null,
      bank_name: newBankName || null,
    });

    if (res.success) {
      setIsAddingRecipient(false);
      setNewName("");
      setNewAccountNumber("");
      setNewBankName("");
      setNewBankName("");
      toast.success(`${newName} has been added!`);
      fetchData();
    } else {
      toast.error(res.error || "Failed to add recipient");
    }
  };

  const handleDeleteRecipient = async (id: string) => {
    if (!confirm("Remove this person from your list?")) return;
    const res = await deleteRecipient(id);
    if (res.success) {
      toast.success("Recipient removed");
      fetchData();
    }
  };

  const handleSendMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipient) return;

    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const selectedAcc = accounts.find(a => a.id === sendAccountId);
    if (selectedAcc && selectedAcc.balance < amount) {
      toast.error("Insufficient balance");
      return;
    }

    setSending(true);
    const res = await sendMoneyToFamily({
      account_id: sendAccountId,
      recipient_id: selectedRecipient.id,
      amount,
      note: sendNote,
    });

    if (res.success) {
      setIsSendingMoney(false);
      setSendAmount("");
      setSendNote("");
      setSelectedRecipient(null);
      setSending(false);
      toast.success(`₹${amount.toLocaleString()} sent to ${selectedRecipient.name}!`);
      fetchData();
    } else {
      setSending(false);
      toast.error(res.error || "Failed to send money");
    }
  };

  const getConfig = (rel: string | null) => RELATIONSHIP_CONFIG[rel || "Other"] || RELATIONSHIP_CONFIG.Other;

  const filteredRecipients = activeFilter === "All"
    ? recipients
    : recipients.filter(r => r.relationship === activeFilter);

  const totalSent = recentSends.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <div className="space-y-8 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-[--text-primary]">
            Family & Friends
          </h1>
          <p className="text-sm mt-1.5 font-medium text-[--text-muted]">
            Send money to your loved ones instantly
          </p>
        </div>
        <button
          onClick={() => setIsAddingRecipient(true)}
          className="btn-primary flex items-center gap-2.5 h-11 px-5"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add Person
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card-static p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[--text-muted] mb-1">Total Contacts</p>
          <p className="text-3xl font-black text-[--text-primary]">{recipients.length}</p>
        </div>
        <div className="glass-card-static p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[--text-muted] mb-1">Family Members</p>
          <p className="text-3xl font-black text-[--accent-primary-light]">
            {recipients.filter(r => r.relationship === "Family").length}
          </p>
        </div>
        <div className="glass-card-static p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[--text-muted] mb-1">Recently Sent</p>
          <p className="text-3xl font-black text-[#55efc4]">
            {totalSent.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["All", "Family", "Friend", "Other"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              background: activeFilter === tab ? "var(--accent-primary)" : "rgba(255,255,255,0.03)",
              color: activeFilter === tab ? "white" : "var(--text-muted)",
              border: `1px solid ${activeFilter === tab ? "var(--accent-primary)" : "rgba(255,255,255,0.05)"}`,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Recipients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 skeleton" style={{ borderRadius: "var(--radius-xl)" }} />
          ))
        ) : filteredRecipients.length === 0 ? (
          <div
            className="col-span-full py-20 text-center glass-card-static"
            style={{ borderStyle: "dashed" }}
          >
            <div className="text-5xl mb-4">👥</div>
            <p className="text-lg font-semibold text-[--text-primary]">
              {activeFilter === "All" ? "No contacts yet" : `No ${activeFilter.toLowerCase()} contacts`}
            </p>
            <p className="text-sm text-[--text-muted] mt-1">
              Click &ldquo;Add Person&rdquo; to get started
            </p>
          </div>
        ) : (
          filteredRecipients.map((person, index) => {
            const config = getConfig(person.relationship);
            return (
              <div
                key={person.id}
                className={`glass-card group animate-fade-in-up delay-${Math.min(index + 1, 6)}`}
                style={{ padding: "24px" }}
              >
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg"
                        style={{
                          background: config.gradient,
                          boxShadow: `0 8px 24px ${config.color}33`,
                        }}
                      >
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-[--text-primary] leading-tight">
                          {person.name}
                        </h3>
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: config.color }}
                        >
                          {config.emoji} {person.relationship}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRecipient(person.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 text-[--text-muted] hover:text-red-400 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Bank Info */}
                  {person.bank_name && (
                    <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5">
                      <svg className="w-4 h-4 text-[--text-muted]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className="text-xs text-[--text-secondary] font-medium">
                        {person.bank_name}
                        {person.account_number && (
                          <span className="text-[--text-muted]"> • ****{person.account_number.slice(-4)}</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Send Button */}
                  <button
                    onClick={() => {
                      setSelectedRecipient(person);
                      setSendAmount("");
                      setSendNote("");
                      setIsSendingMoney(true);
                    }}
                    className="mt-auto w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                    style={{
                      background: `${config.color}15`,
                      border: `1px solid ${config.color}25`,
                      color: config.color,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = config.gradient;
                      e.currentTarget.style.color = "white";
                      e.currentTarget.style.borderColor = "transparent";
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = `0 8px 24px ${config.color}33`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `${config.color}15`;
                      e.currentTarget.style.color = config.color;
                      e.currentTarget.style.borderColor = `${config.color}25`;
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send Money
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recent Activity */}
      {recentSends.length > 0 && (
        <div className="glass-card-static overflow-hidden" style={{ borderRadius: "var(--radius-xl)" }}>
          <div className="px-6 py-4 border-b border-white/5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[--text-muted]">
              Recent Transfers
            </h3>
          </div>
          <div className="divide-y divide-white/5">
            {recentSends.slice(0, 5).map((send) => (
              <div key={send.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[--text-primary]">{send.details}</p>
                    <p className="text-[10px] text-[--text-muted]">
                      {new Date(send.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-red-400">
                  -{(send.amount || 0).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Recipient Modal */}
      {isAddingRecipient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay animate-fade-in">
          <div
            className="glass-card-static w-full max-w-md animate-scale-in overflow-hidden"
            style={{ border: "1px solid var(--border-strong)" }}
          >
            <div className="px-8 pt-8 pb-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: RELATIONSHIP_CONFIG[newRelationship]?.gradient || RELATIONSHIP_CONFIG.Other.gradient }}
                >
                  <span className="text-xl">{RELATIONSHIP_CONFIG[newRelationship]?.emoji || "👤"}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[--text-primary]">Add Contact</h2>
                  <p className="text-xs text-[--text-muted]">Send money to them anytime</p>
                </div>
              </div>

              <form onSubmit={handleAddRecipient} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-1.5 ml-1">
                    Full Name *
                  </label>
                  <input
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="input-premium h-12"
                    placeholder="e.g. Priya Sharma"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-1.5 ml-1">
                    Relationship
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Family", "Friend", "Other"] as const).map((rel) => {
                      const cfg = RELATIONSHIP_CONFIG[rel];
                      const isActive = newRelationship === rel;
                      return (
                        <button
                          key={rel}
                          type="button"
                          onClick={() => setNewRelationship(rel)}
                          className="py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                          style={{
                            background: isActive ? cfg.gradient : "rgba(255,255,255,0.03)",
                            color: isActive ? "white" : cfg.color,
                            border: `1px solid ${isActive ? "transparent" : `${cfg.color}25`}`,
                            boxShadow: isActive ? `0 4px 16px ${cfg.color}33` : "none",
                          }}
                        >
                          {cfg.emoji} {rel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-1.5 ml-1">
                      Bank Name
                    </label>
                    <input
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      className="input-premium"
                      placeholder="e.g. HDFC"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-1.5 ml-1">
                      Account No.
                    </label>
                    <input
                      value={newAccountNumber}
                      onChange={(e) => setNewAccountNumber(e.target.value)}
                      className="input-premium"
                      placeholder="e.g. 1234..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingRecipient(false)}
                    className="btn-secondary flex-1 h-12"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary flex-1 h-12">
                    Save Contact
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Send Money Modal */}
      {isSendingMoney && selectedRecipient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay animate-fade-in">
          <div
            className="glass-card-static w-full max-w-md animate-scale-in overflow-hidden"
            style={{ border: "1px solid var(--border-strong)" }}
          >
            <div className="px-8 pt-8 pb-6">
              {/* Recipient Header */}
              <div className="flex items-center gap-4 mb-8">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg"
                  style={{
                    background: getConfig(selectedRecipient.relationship).gradient,
                    boxShadow: `0 8px 24px ${getConfig(selectedRecipient.relationship).color}33`,
                  }}
                >
                  {selectedRecipient.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[--text-primary]">
                    Send to {selectedRecipient.name}
                  </h2>
                  <p className="text-xs text-[--text-muted] uppercase tracking-widest font-bold mt-0.5">
                    {getConfig(selectedRecipient.relationship).emoji} {selectedRecipient.relationship}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendMoney} className="space-y-5">
                {/* Account Selector */}
                <div>
                  <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-1.5 ml-1">
                    From Account
                  </label>
                  <select
                    required
                    value={sendAccountId}
                    onChange={(e) => setSendAccountId(e.target.value)}
                    className="input-premium h-14"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id} style={{ background: "var(--bg-surface)" }}>
                        {acc.name} — {acc.currency} {acc.balance.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-1.5 ml-1">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-[--text-muted]">
                      {accounts.find(a => a.id === sendAccountId)?.currency === 'USD' ? '$' : '₹'}
                    </span>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="1"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="input-premium pl-10 h-16 text-2xl font-black"
                      style={{ color: "var(--accent-primary-light)" }}
                      placeholder="0"
                    />
                  </div>
                  {/* Quick Amounts */}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setSendAmount(amt.toString())}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: sendAmount === amt.toString() ? "var(--accent-primary)" : "rgba(255,255,255,0.03)",
                          color: sendAmount === amt.toString() ? "white" : "var(--text-muted)",
                          border: `1px solid ${sendAmount === amt.toString() ? "var(--accent-primary)" : "rgba(255,255,255,0.05)"}`,
                        }}
                      >
                        ₹{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-widest mb-1.5 ml-1">
                    Note (Optional)
                  </label>
                  <input
                    value={sendNote}
                    onChange={(e) => setSendNote(e.target.value)}
                    className="input-premium h-12"
                    placeholder="What's this for?"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSendingMoney(false);
                      setSelectedRecipient(null);
                    }}
                    className="btn-secondary flex-1 h-12"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="btn-primary flex-1 h-12 flex items-center justify-center gap-2"
                    style={{ opacity: sending ? 0.6 : 1 }}
                  >
                    {sending ? (
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send {accounts.find(a => a.id === sendAccountId)?.currency === 'USD' ? '$' : '₹'}{sendAmount ? parseFloat(sendAmount).toLocaleString() : "0"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
