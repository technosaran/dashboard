"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import { createClient } from "@/lib/supabase-browser";
import { createRecipient, deleteRecipient, sendMoneyToFamily, updateRecipient } from "./actions";
import { getAccounts } from "../accounts/actions";
import { toast } from "react-hot-toast";
import { useSubmitLock } from "@/hooks/use-submit-lock";
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

const RELATIONSHIP_CONFIG: Record<string, { emoji: string; color: string; soft: string }> = {
  Family: { emoji: "👨‍👩‍👧‍👦", color: "var(--accent-primary-light)", soft: "rgba(162, 155, 254, 0.16)" },
  Friend: { emoji: "🤝", color: "var(--success)", soft: "rgba(0, 184, 148, 0.16)" },
  Other: { emoji: "👤", color: "var(--warning)", soft: "rgba(253, 203, 110, 0.16)" },
};

interface FamilyClientProps {
  initialRecipients: Recipient[];
  initialAccounts: Account[];
  initialHistory: SendHistory[];
}

export default function FamilyClient({
  initialRecipients,
  initialAccounts,
  initialHistory,
}: FamilyClientProps) {
  const supabase = createClient();
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [loading, setLoading] = useState(false);
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [isSendingMoney, setIsSendingMoney] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [recentSends, setRecentSends] = useState<SendHistory[]>(initialHistory);
  const [submitting, withLock] = useSubmitLock();
  const [activeFilter, setActiveFilter] = useState<string>("All");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"contacts" | "history">("contacts");
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);

  // Form states
  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] = useState("Family");

  const [sendAmount, setSendAmount] = useState("");
  const [sendAccountId, setSendAccountId] = useState(initialAccounts[0]?.id || "");
  const [sendNote, setSendNote] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

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
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("family-realtime-v1")
      .on("postgres_changes", { event: "*", schema: "public", table: "recipients" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => startTransition(fetchData))
      .on("postgres_changes", { event: "*", schema: "public", table: "ledger_logs" }, () => startTransition(fetchData))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase]);

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    await withLock(async () => {
      let res;
      if (isEditingRecipient && editingRecipient) {
        res = await updateRecipient(editingRecipient.id, {
          name: newName,
          relationship: newRelationship,
        });
        
        if (res.success) {
          toast.success(`${newName} updated`);
          setIsAddingRecipient(false);
          setIsEditingRecipient(false);
          setEditingRecipient(null);
          fetchData();
        } else {
          toast.error(res.error || "Failed to update contact");
        }
        return;
      }

      res = await createRecipient({
        name: newName,
        relationship: newRelationship,
      });

      if (res.success) {
        setIsAddingRecipient(false);
        setIsEditingRecipient(false);
        setEditingRecipient(null);
        setNewName("");
        toast.success(`${newName} added to contacts`);
        fetchData();
      } else {
        toast.error(res.error || "Failed to add recipient");
      }
    });
  };

  const startEdit = (person: Recipient) => {
    setEditingRecipient(person);
    setNewName(person.name);
    setNewRelationship(person.relationship || "Other");
    setIsEditingRecipient(true);
    setIsAddingRecipient(true);
  };

  const handleDeleteRecipient = async (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    await withLock(async () => {
      const res = await deleteRecipient(deletingId);
      if (res.success) {
        toast.success("Contact removed");
        fetchData();
      } else {
        toast.error(res.error || "Failed to remove contact");
      }
      setShowDeleteConfirm(false);
      setDeletingId(null);
    });
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

    await withLock(async () => {
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
        toast.success(`₹${amount.toLocaleString()} sent to ${selectedRecipient.name}`);
        fetchData();
      } else {
        toast.error(res.error || "Failed to send money");
      }
    });
  };

  const getConfig = (rel: string | null) => RELATIONSHIP_CONFIG[rel || "Other"] || RELATIONSHIP_CONFIG.Other;

  const filteredRecipients = activeFilter === "All"
    ? recipients
    : recipients.filter(r => r.relationship === activeFilter);

  const totalSent = recentSends.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <div className="flex flex-col gap-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[--text-primary]">
            Family & Friends
          </h1>
          <p className="text-sm mt-1.5 text-[--text-muted]">
            Manage your contacts and transfer money quickly.
          </p>
        </div>
        <button
          onClick={() => setIsAddingRecipient(true)}
          className="bg-[--accent-primary] hover:bg-opacity-90 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Contact
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 flex flex-col gap-2">
          <p className="text-xs font-medium text-[--text-muted]">Total Contacts</p>
          <p className="text-3xl font-light text-[--text-primary]">{recipients.length}</p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 flex flex-col gap-2">
          <p className="text-xs font-medium text-[--text-muted]">Family Members</p>
          <p className="text-3xl font-light text-[--text-primary]">
            {recipients.filter(r => r.relationship === "Family").length}
          </p>
        </div>
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-6 flex flex-col gap-2">
          <p className="text-xs font-medium text-[--text-muted]">Recently Sent</p>
          <p className="text-3xl font-light text-success">
            ₹{totalSent.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter Tabs & History Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(["All", "Family", "Friend", "Other"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap min-h-[38px] flex items-center justify-center ${
                activeFilter === tab 
                  ? "bg-[--accent-primary] text-white shadow-sm" 
                  : "bg-white/[0.02] text-[--text-muted] hover:bg-white/[0.05] border border-white/[0.05]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="flex bg-white/[0.02] border border-white/[0.05] p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveView("contacts")}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeView === "contacts" ? "bg-white/[0.1] text-[--text-primary]" : "text-[--text-muted] hover:text-[--text-primary]"}`}
          >
            Contacts
          </button>
          <button
            onClick={() => setActiveView("history")}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeView === "history" ? "bg-white/[0.1] text-[--text-primary]" : "text-[--text-muted] hover:text-[--text-primary]"}`}
          >
            History
          </button>
        </div>
      </div>

      {/* Main View Render */}
      {activeView === "contacts" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[180px] bg-white/[0.02] border border-white/[0.05] rounded-2xl animate-pulse" />
            ))
          ) : filteredRecipients.length === 0 ? (
            <div
              className="col-span-full py-20 text-center bg-white/[0.01] border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center gap-3"
            >
              <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-2">
                 <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </div>
              <p className="text-xl font-medium text-[--text-primary]">
                {activeFilter === "All" ? "No contacts yet" : `No ${activeFilter.toLowerCase()} contacts`}
              </p>
              <p className="text-sm text-[--text-muted] max-w-sm mx-auto">
                Add a contact to start sending money from this section.
              </p>
            </div>
          ) : (
            filteredRecipients.map((person) => {
              const config = getConfig(person.relationship);
              return (
                <div key={person.id} className="group bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] rounded-2xl p-5 transition-all flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium" style={{ backgroundColor: config.soft, color: config.color }}>
                        {person.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-base font-medium text-[--text-primary]">{person.name}</h3>
                        <p className="text-xs text-[--text-muted] mt-1">{person.relationship || "Other"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(person)} className="p-2 text-[--text-muted] hover:text-white transition-colors rounded-full hover:bg-white/[0.05]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDeleteRecipient(person.id)} className="p-2 text-[--text-muted] hover:text-danger transition-colors rounded-full hover:bg-white/[0.05]">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-2 pt-4 border-t border-white/[0.05]">
                    <button
                      onClick={() => { setSelectedRecipient(person); setSendAmount(""); setSendNote(""); setIsSendingMoney(true); }}
                      className="w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 bg-white/[0.03] hover:bg-white/[0.08] text-[--text-primary]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      Send Money
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden animate-fade-in">
          <div className="px-6 py-4 border-b border-white/[0.05] bg-white/[0.01]">
            <h3 className="text-sm font-medium text-[--text-primary]">Recent Transfers</h3>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {recentSends.length === 0 ? (
               <div className="py-16 text-center text-sm text-[--text-muted]">No recent transfers yet.</div>
            ) : (
              recentSends.map((send) => (
                <div key={send.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-400/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[--text-primary]">{send.details || "Transfer"}</p>
                      <p className="text-xs text-[--text-muted] mt-1">
                        {send.created_at ? format(new Date(send.created_at), "MMM d, yyyy • h:mm a") : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-medium text-danger">-₹{(send.amount || 0).toLocaleString()}</p>
                    <p className="text-xs text-success mt-1">Completed</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isAddingRecipient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-medium text-[--text-primary]">{isEditingRecipient ? "Edit Contact" : "Add Contact"}</h2>
                  <p className="text-sm text-[--text-muted] mt-1">{isEditingRecipient ? "Update details for this contact." : "Enter contact details below."}</p>
                </div>
                <button onClick={() => { setIsAddingRecipient(false); setIsEditingRecipient(false); setEditingRecipient(null); setNewName(""); }} className="p-2 text-[--text-muted] hover:text-[--text-primary] transition-colors rounded-full hover:bg-white/5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleAddRecipient} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[--text-secondary] mb-2">Full Name</label>
                  <input required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-[--text-primary] focus:border-[--accent-primary] focus:ring-1 focus:ring-[--accent-primary] outline-none transition-all placeholder-white/20" placeholder="e.g. Priya Sharma" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--text-secondary] mb-2">Relationship</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["Family", "Friend", "Other"] as const).map((rel) => {
                      const isActive = newRelationship === rel;
                      return (
                        <button key={rel} type="button" onClick={() => setNewRelationship(rel)} className={`py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-[--accent-primary] text-white' : 'bg-white/[0.03] text-[--text-muted] hover:bg-white/[0.06] border border-white/[0.05]'}`}>
                          {rel}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => { setIsAddingRecipient(false); setIsEditingRecipient(false); setEditingRecipient(null); setNewName(""); }} className="flex-1 py-3.5 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl text-sm font-medium transition-all text-[--text-primary]">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 py-3.5 bg-[--accent-primary] hover:bg-opacity-90 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                    {submitting ? "Saving..." : isEditingRecipient ? "Save Changes" : "Save Contact"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isSendingMoney && selectedRecipient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-in">
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium" style={{ backgroundColor: getConfig(selectedRecipient.relationship).soft, color: getConfig(selectedRecipient.relationship).color }}>
                    {selectedRecipient.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-medium text-[--text-primary]">Send Money</h2>
                    <p className="text-sm text-[--text-muted] mt-1">To {selectedRecipient.name}</p>
                  </div>
                </div>
                <button onClick={() => { setIsSendingMoney(false); setSelectedRecipient(null); }} className="p-2 text-[--text-muted] hover:text-[--text-primary] transition-colors rounded-full hover:bg-white/5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleSendMoney} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-[--text-secondary] mb-2">From Account</label>
                  <select required value={sendAccountId} onChange={(e) => setSendAccountId(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[--text-primary] focus:border-[--accent-primary] outline-none transition-all appearance-none cursor-pointer">
                    {accounts.map((acc) => (<option key={acc.id} value={acc.id} className="bg-[#0a0a0a] text-[--text-primary]">{acc.name} ({acc.currency} {acc.balance.toLocaleString()})</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--text-secondary] mb-2">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[--text-muted]">
                      {accounts.find(a => a.id === sendAccountId)?.currency === 'USD' ? '$' : '₹'}
                    </span>
                    <input required type="number" step="0.01" min="1" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-4 py-4 text-2xl font-medium text-[--text-primary] focus:border-[--accent-primary] outline-none transition-all placeholder-white/10" placeholder="0.00" />
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button key={amt} type="button" onClick={() => setSendAmount(amt.toString())} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${sendAmount === amt.toString() ? 'bg-[--accent-primary] text-white' : 'bg-white/[0.03] border border-white/[0.08] text-[--text-muted] hover:bg-white/[0.06]'}`}>
                        ₹{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--text-secondary] mb-2">Note (Optional)</label>
                  <input value={sendNote} onChange={(e) => setSendNote(e.target.value)} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-[--text-primary] focus:border-[--accent-primary] outline-none transition-all placeholder-white/20" placeholder="What's this for?" />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => { setIsSendingMoney(false); setSelectedRecipient(null); }} className="flex-1 py-4 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl text-sm font-medium transition-all text-[--text-primary]">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-[2] py-4 bg-[--accent-primary] hover:bg-opacity-90 text-white rounded-xl text-sm font-medium transition-all flex items-center justify-center disabled:opacity-50">
                    {submitting ? (
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      `Send Money`
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0a0a0a] border border-white/[0.08] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 md:p-8 text-center animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-danger/10 text-danger mx-auto flex items-center justify-center mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-medium text-[--text-primary] mb-2">Remove Contact?</h3>
            <p className="text-sm text-[--text-muted] mb-8 leading-relaxed">This will permanently remove <span className="text-[--text-primary] font-medium">{recipients.find(r => r.id === deletingId)?.name}</span> from your contacts.</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => { setShowDeleteConfirm(false); setDeletingId(null); }} className="flex-1 py-3.5 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl text-sm font-medium transition-all text-[--text-primary]">Cancel</button>
              <button onClick={confirmDelete} disabled={submitting} className="flex-1 py-3.5 bg-danger hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                {submitting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
