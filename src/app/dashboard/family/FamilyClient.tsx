"use client";

import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import { createRecipient, deleteRecipient, sendMoneyToFamily, updateRecipient } from "./actions";
import { getAccounts } from "../accounts/actions";
import { toast } from "react-hot-toast";
import { format } from "date-fns";

type Recipient = {
  id: string;
  name: string;
  relationship: string | null;
  created_at: string | null;
};

type Account = {
  id: string;
  name: string;
  balance: number;
  currency: string;
};

type SendHistory = {
  id: string;
  created_at: string | null;
  details: string | null;
  amount: number | null;
  action_type: string;
};

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];
const FILTERS = ["All", "Family", "Friend", "Other"] as const;
const RELATIONSHIPS = ["Family", "Friend", "Other"] as const;

const RELATIONSHIP_CONFIG: Record<
  string,
  { emoji: string; color: string; soft: string; iconBg: string }
> = {
  Family: {
    emoji: "👨‍👩‍👧‍👦",
    color: "var(--accent-primary-light)",
    soft: "rgba(162, 155, 254, 0.14)",
    iconBg: "rgba(162, 155, 254, 0.24)",
  },
  Friend: {
    emoji: "🤝",
    color: "var(--success)",
    soft: "rgba(0, 184, 148, 0.14)",
    iconBg: "rgba(0, 184, 148, 0.24)",
  },
  Other: {
    emoji: "👤",
    color: "var(--warning)",
    soft: "rgba(253, 203, 110, 0.14)",
    iconBg: "rgba(253, 203, 110, 0.24)",
  },
};

interface FamilyClientProps {
  initialRecipients: Recipient[];
  initialAccounts: Account[];
  initialHistory: SendHistory[];
}

const getConfig = (relationship: string | null) =>
  RELATIONSHIP_CONFIG[relationship || "Other"] || RELATIONSHIP_CONFIG.Other;

const getCurrencySymbol = (currency?: string) => (currency === "USD" ? "$" : "₹");

const formatAmount = (amount: number, currency: string = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${getCurrencySymbol(currency)}${amount.toLocaleString()}`;
  }
};

export default function FamilyClient({
  initialRecipients,
  initialAccounts,
  initialHistory,
}: FamilyClientProps) {
  const supabase = createClient();

  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [recentSends, setRecentSends] = useState<SendHistory[]>(initialHistory);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [activeView, setActiveView] = useState<"contacts" | "history">("contacts");

  const [isRecipientModalOpen, setIsRecipientModalOpen] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [recipientRelationship, setRecipientRelationship] = useState<string>("Family");

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [sendAmount, setSendAmount] = useState("");
  const [sendAccountId, setSendAccountId] = useState(initialAccounts[0]?.id || "");
  const [sendNote, setSendNote] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === sendAccountId),
    [accounts, sendAccountId]
  );

  useEffect(() => {
    if (accounts.length > 0 && !accounts.some((account) => account.id === sendAccountId)) {
      setSendAccountId(accounts[0].id);
    }
  }, [accounts, sendAccountId]);

  useEffect(() => {
    const shouldLockScroll = isRecipientModalOpen || isTransferModalOpen || showDeleteConfirm;
    if (!shouldLockScroll) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isRecipientModalOpen, isTransferModalOpen, showDeleteConfirm]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("family-realtime-v2")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recipients" },
        () => startTransition(fetchData)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts" },
        () => startTransition(fetchData)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ledger_logs" },
        () => startTransition(fetchData)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase]);

  const closeRecipientModal = () => {
    setIsRecipientModalOpen(false);
    setEditingRecipient(null);
    setRecipientName("");
    setRecipientRelationship("Family");
  };

  const openAddRecipientModal = () => {
    setEditingRecipient(null);
    setRecipientName("");
    setRecipientRelationship("Family");
    setIsRecipientModalOpen(true);
  };

  const startEdit = (recipient: Recipient) => {
    setEditingRecipient(recipient);
    setRecipientName(recipient.name);
    setRecipientRelationship(recipient.relationship || "Other");
    setIsRecipientModalOpen(true);
  };

  const openTransferModal = (recipient: Recipient) => {
    setSelectedRecipient(recipient);
    setSendAmount("");
    setSendNote("");
    setIsTransferModalOpen(true);
  };

  const closeTransferModal = () => {
    setIsTransferModalOpen(false);
    setSelectedRecipient(null);
    setSendAmount("");
    setSendNote("");
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedName = recipientName.trim();
    if (normalizedName.length < 2) {
      toast.error("Name must be at least 2 characters long.");
      return;
    }

    const payload = {
      name: normalizedName,
      relationship: recipientRelationship,
    };

    const result = editingRecipient
      ? await updateRecipient(editingRecipient.id, payload)
      : await createRecipient(payload);

    if (result.success) {
      toast.success(editingRecipient ? `${normalizedName} updated` : `${normalizedName} added`);
      closeRecipientModal();
      fetchData();
      return;
    }

    toast.error(result.error || "Failed to save contact");
  };

  const handleDeleteRecipient = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;

    const result = await deleteRecipient(deletingId);
    if (result.success) {
      toast.success("Contact removed");
      setShowDeleteConfirm(false);
      setDeletingId(null);
      fetchData();
      return;
    }

    toast.error(result.error || "Failed to remove contact");
  };

  const handleSendMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipient) return;

    if (!sendAccountId) {
      toast.error("Please select an account.");
      return;
    }

    const amount = parseFloat(sendAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    if (selectedAccount && selectedAccount.balance < amount) {
      toast.error("Insufficient balance");
      return;
    }

    setSending(true);
    const result = await sendMoneyToFamily({
      account_id: sendAccountId,
      recipient_id: selectedRecipient.id,
      amount,
      note: sendNote.trim(),
    });
    setSending(false);

    if (result.success) {
      toast.success(`${formatAmount(amount, selectedAccount?.currency || "INR")} sent to ${selectedRecipient.name}`);
      closeTransferModal();
      fetchData();
      return;
    }

    toast.error(result.error || "Failed to send money");
  };

  const filteredRecipients =
    activeFilter === "All"
      ? recipients
      : recipients.filter((recipient) => recipient.relationship === activeFilter);

  const totalSent = recentSends.reduce((sum, send) => sum + (send.amount || 0), 0);

  const sectionStats = [
    {
      label: "Contacts",
      value: recipients.length.toString(),
      accent: "text-[--text-primary]",
    },
    {
      label: "Family",
      value: recipients.filter((recipient) => recipient.relationship === "Family").length.toString(),
      accent: "text-[--accent-primary-light]",
    },
    {
      label: "Transferred",
      value: formatAmount(totalSent),
      accent: "text-success",
    },
  ];

  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      <section className="glass-card-static p-5 md:p-7 border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-[--text-muted] font-bold mb-2">Family Section</p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[--text-primary]">Family & Friends</h1>
            <p className="text-sm mt-2 text-[--text-muted] max-w-xl">
              Manage your trusted contacts and transfer money from one clean place.
            </p>
          </div>
          <button onClick={openAddRecipientModal} className="btn-primary h-11 px-5 flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add contact
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {sectionStats.map((stat) => (
          <div key={stat.label} className="glass-card-static p-5 md:p-6 border border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-2">{stat.label}</p>
            <p className={`text-3xl font-black ${stat.accent}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="glass-card-static p-4 md:p-5 border border-white/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className="px-4 h-10 rounded-xl text-[10px] font-bold uppercase tracking-[0.16em] whitespace-nowrap transition-all"
              style={{
                background: activeFilter === tab ? "rgba(108, 92, 231, 0.18)" : "rgba(255,255,255,0.02)",
                color: activeFilter === tab ? "var(--text-primary)" : "var(--text-muted)",
                border: `1px solid ${activeFilter === tab ? "rgba(108, 92, 231, 0.42)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex bg-white/5 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveView("contacts")}
            className={`px-4 h-9 rounded-lg text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
              activeView === "contacts"
                ? "bg-white text-[--bg-base]"
                : "text-[--text-muted] hover:text-[--text-primary]"
            }`}
          >
            Contacts ({recipients.length})
          </button>
          <button
            onClick={() => setActiveView("history")}
            className={`px-4 h-9 rounded-lg text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
              activeView === "history"
                ? "bg-white text-[--bg-base]"
                : "text-[--text-muted] hover:text-[--text-primary]"
            }`}
          >
            History
          </button>
        </div>
      </section>

      {activeView === "contacts" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-64 skeleton rounded-[var(--radius-xl)]" />
            ))
          ) : filteredRecipients.length === 0 ? (
            <div className="col-span-full glass-card-static border border-dashed border-white/20 py-16 text-center">
              <p className="text-xl md:text-2xl font-black text-[--text-primary]">
                {activeFilter === "All" ? "No contacts yet" : `No ${activeFilter.toLowerCase()} contacts`}
              </p>
              <p className="text-sm text-[--text-muted] mt-2">Add a contact to start sending money.</p>
            </div>
          ) : (
            filteredRecipients.map((person) => {
              const config = getConfig(person.relationship);
              return (
                <article
                  key={person.id}
                  className="glass-card-static min-h-[238px] p-5 border border-white/10 hover:border-white/20 transition-colors flex flex-col"
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-black text-white"
                        style={{ background: config.iconBg }}
                      >
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-[--text-primary] truncate max-w-[180px]">{person.name}</h3>
                        <p className="text-[10px] text-[--text-muted] uppercase tracking-[0.16em] font-bold mt-0.5">
                          {person.created_at ? `Added ${format(new Date(person.created_at), "MMM d, yyyy")}` : "Recently added"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => startEdit(person)}
                      className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-[--text-muted] hover:text-white transition-colors"
                      aria-label={`Edit ${person.name}`}
                    >
                      <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </header>

                  <div className="mt-4">
                    <span
                      className="inline-flex items-center gap-2 px-3 h-7 rounded-full text-[10px] font-black uppercase tracking-[0.14em]"
                      style={{ background: config.soft, color: config.color, border: `1px solid ${config.color}45` }}
                    >
                      <span>{config.emoji}</span>
                      <span>{person.relationship || "Other"}</span>
                    </span>
                  </div>

                  <div className="mt-auto pt-5 flex gap-2">
                    <button
                      onClick={() => openTransferModal(person)}
                      className="flex-1 h-10 rounded-lg font-bold text-[11px] uppercase tracking-[0.12em] flex items-center justify-center gap-2"
                      style={{ background: config.soft, color: config.color, border: `1px solid ${config.color}50` }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send
                    </button>
                    <button
                      onClick={() => handleDeleteRecipient(person.id)}
                      className="w-10 h-10 rounded-lg bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 transition-colors"
                      aria-label={`Delete ${person.name}`}
                    >
                      <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      ) : (
        <section className="glass-card-static overflow-hidden border border-white/10">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="text-xs md:text-sm font-black uppercase tracking-[0.14em] text-[--text-primary]">Recent transfers</h3>
          </div>
          <div className="divide-y divide-white/10">
            {recentSends.length === 0 ? (
              <div className="py-14 text-center text-[--text-muted]">No recent transfers yet.</div>
            ) : (
              recentSends.map((send) => (
                <div key={send.id} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[--text-primary] truncate">{send.details || "Transfer"}</p>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[--text-muted] mt-1">
                      {send.created_at ? format(new Date(send.created_at), "PPP • p") : "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base md:text-lg font-black text-danger">-{formatAmount(send.amount || 0)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-success">Completed</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {isRecipientModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in">
          <div className="glass-card-static w-full max-w-md max-h-[95vh] overflow-y-auto border border-white/10 animate-scale-in">
            <div className="px-6 md:px-8 py-7">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-black text-[--text-primary]">
                    {editingRecipient ? "Edit Contact" : "Add Contact"}
                  </h2>
                  <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[--text-muted] mt-1">
                    {editingRecipient ? "Update contact details" : "Create new contact"}
                  </p>
                </div>
                <button
                  onClick={closeRecipientModal}
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 text-[--text-muted] hover:text-[--text-primary]"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddRecipient} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-[0.16em] mb-1.5">Full Name *</label>
                  <input
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="input-premium"
                    placeholder="e.g. Priya Sharma"
                    maxLength={80}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-[0.16em] mb-1.5">Relationship</label>
                  <div className="grid grid-cols-3 gap-2">
                    {RELATIONSHIPS.map((relationship) => {
                      const config = RELATIONSHIP_CONFIG[relationship];
                      const isActive = recipientRelationship === relationship;
                      return (
                        <button
                          key={relationship}
                          type="button"
                          onClick={() => setRecipientRelationship(relationship)}
                          className="h-10 rounded-xl text-xs font-bold transition-all"
                          style={{
                            background: isActive ? config.soft : "rgba(255,255,255,0.03)",
                            color: isActive ? "var(--text-primary)" : config.color,
                            border: `1px solid ${isActive ? `${config.color}70` : `${config.color}30`}`,
                          }}
                        >
                          {config.emoji} {relationship}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeRecipientModal} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary flex-1">
                    {editingRecipient ? "Save Changes" : "Save Contact"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isTransferModalOpen && selectedRecipient && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-overlay animate-fade-in">
          <div className="glass-card-static w-full max-w-md border border-white/10 animate-scale-in">
            <div className="px-6 md:px-8 py-7">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white"
                  style={{ background: getConfig(selectedRecipient.relationship).color }}
                >
                  {selectedRecipient.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-black text-[--text-primary]">Send to {selectedRecipient.name}</h2>
                  <p className="text-[10px] uppercase tracking-[0.14em] font-bold text-[--text-muted] mt-1">
                    {getConfig(selectedRecipient.relationship).emoji} {selectedRecipient.relationship || "Other"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendMoney} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-[0.16em] mb-1.5">From Account</label>
                  <select
                    required
                    value={sendAccountId}
                    onChange={(e) => setSendAccountId(e.target.value)}
                    className="input-premium h-12"
                  >
                    {accounts.length === 0 ? (
                      <option value="">No account available</option>
                    ) : (
                      accounts.map((account) => (
                        <option key={account.id} value={account.id} style={{ background: "var(--bg-surface)" }}>
                          {account.name} — {formatAmount(account.balance, account.currency)}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-[0.16em] mb-1.5">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-[--text-muted]">
                      {getCurrencySymbol(selectedAccount?.currency)}
                    </span>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="1"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      className="input-premium h-14 pl-10 text-2xl font-black"
                      style={{ color: "var(--accent-primary-light)" }}
                      placeholder="0"
                    />
                  </div>

                  <div className="flex gap-2 mt-3 flex-wrap">
                    {QUICK_AMOUNTS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setSendAmount(amount.toString())}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{
                          background: sendAmount === amount.toString() ? "var(--accent-primary)" : "rgba(255,255,255,0.03)",
                          color: sendAmount === amount.toString() ? "white" : "var(--text-muted)",
                          border: `1px solid ${sendAmount === amount.toString() ? "var(--accent-primary)" : "rgba(255,255,255,0.06)"}`,
                        }}
                      >
                        ₹{amount.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[--text-muted] uppercase tracking-[0.16em] mb-1.5">Note (Optional)</label>
                  <input
                    value={sendNote}
                    onChange={(e) => setSendNote(e.target.value)}
                    className="input-premium h-12"
                    placeholder="What is this for?"
                    maxLength={120}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeTransferModal}
                    className="btn-secondary flex-1 order-2 sm:order-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sending || accounts.length === 0}
                    className="btn-primary flex-1 order-1 sm:order-2"
                  >
                    {sending
                      ? "Sending..."
                      : `Send ${getCurrencySymbol(selectedAccount?.currency)}${
                          sendAmount ? parseFloat(sendAmount || "0").toLocaleString() : "0"
                        }`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card-static w-full max-w-sm p-7 border border-red-500/20 animate-scale-in">
            <div className="text-center">
              <h3 className="text-xl font-black text-[--text-primary]">Remove contact?</h3>
              <p className="text-sm text-[--text-muted] mt-2 mb-6">
                Remove <span className="text-[--text-primary] font-bold">{recipients.find((r) => r.id === deletingId)?.name}</span> from
                your contacts list.
              </p>
              <div className="flex gap-3">
                <button onClick={confirmDelete} className="btn-danger flex-1">
                  Remove
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingId(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
