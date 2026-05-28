"use client";

import { useCallback, useEffect, useState, startTransition, useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import { createRecipient, deleteRecipient, sendMoneyToFamily, updateRecipient } from "./actions";
import { getAccounts } from "../accounts/actions";
import { toast } from "react-hot-toast";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Users, Send, Trash2, Edit3, Plus, X, 
  CreditCard, Sparkles, DollarSign, Wallet, ArrowUpRight 
} from "lucide-react";

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

const RELATIONSHIP_THEMES: Record<string, { gradient: string; accent: string; badge: string; chip: string }> = {
  Family: { 
    gradient: "bg-gradient-to-br from-indigo-950/80 via-purple-900/50 to-slate-950/90 border border-purple-500/20", 
    accent: "#a855f7", 
    badge: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
    chip: "bg-purple-400/20"
  },
  Friend: { 
    gradient: "bg-gradient-to-br from-emerald-950/80 via-teal-900/50 to-slate-950/90 border border-emerald-500/20", 
    accent: "#10b981", 
    badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    chip: "bg-emerald-400/20"
  },
  Other: { 
    gradient: "bg-gradient-to-br from-amber-950/80 via-orange-900/50 to-slate-950/90 border border-amber-500/20", 
    accent: "#f59e0b", 
    badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    chip: "bg-amber-400/20"
  },
};

export default function FamilyClient({
  initialRecipients,
  initialAccounts,
  initialHistory,
}: {
  initialRecipients: Recipient[];
  initialAccounts: Account[];
  initialHistory: SendHistory[];
}) {
  const supabase = createClient();
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [loading, setLoading] = useState(false);
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [isSendingMoney, setIsSendingMoney] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [recentSends, setRecentSends] = useState<SendHistory[]>(initialHistory);
  const [sending, setSending] = useState(false);
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

  const activeAccount = useMemo(() => accounts.find(a => a.id === sendAccountId), [accounts, sendAccountId]);
  const currencySymbol = useMemo(() => activeAccount?.currency === 'USD' ? '$' : '₹', [activeAccount]);

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
        .limit(15),
    ]);

    if (recipRes.data) setRecipients(recipRes.data as Recipient[]);
    if (accRes.data) setAccounts(accRes.data as Account[]);
    if (historyRes.data) setRecentSends(historyRes.data as SendHistory[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("family-realtime-v2")
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
    let res;
    if (isEditingRecipient && editingRecipient) {
      res = await updateRecipient(editingRecipient.id, {
        name: newName,
        relationship: newRelationship,
      });
      
      if (res.success) {
        toast.success(`${newName} updated successfully!`);
        setIsAddingRecipient(false);
        setIsEditingRecipient(false);
        setEditingRecipient(null);
        setNewName("");
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
      toast.success(`${newName} added to contacts!`);
      fetchData();
    } else {
      toast.error(res.error || "Failed to add recipient");
    }
  };

  const startEdit = (person: Recipient) => {
    setEditingRecipient(person);
    setNewName(person.name);
    setNewRelationship(person.relationship || "Other");
    setIsEditingRecipient(true);
    setIsAddingRecipient(true);
  };

  const handleDeleteRecipient = (id: string) => {
    setDeletingId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const res = await deleteRecipient(deletingId);
    if (res.success) {
      toast.success("Contact removed");
      fetchData();
    } else {
      toast.error(res.error || "Failed to remove contact");
    }
    setShowDeleteConfirm(false);
    setDeletingId(null);
  };

  const handleSendMoneySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipient) return;

    const amount = parseFloat(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid transfer amount");
      return;
    }

    if (activeAccount && activeAccount.balance < amount) {
      toast.error("Insufficient account balance");
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
      toast.success(`${currencySymbol}${amount.toLocaleString()} sent to ${selectedRecipient.name}!`);
      fetchData();
    } else {
      setSending(false);
      toast.error(res.error || "Failed to send money");
    }
  };

  const getTheme = (rel: string | null) => RELATIONSHIP_THEMES[rel || "Other"] || RELATIONSHIP_THEMES.Other;

  const filteredRecipients = useMemo(() => {
    return activeFilter === "All"
      ? recipients
      : recipients.filter(r => r.relationship === activeFilter);
  }, [recipients, activeFilter]);

  const totalSent = useMemo(() => {
    return recentSends.reduce((sum, s) => sum + (s.amount || 0), 0);
  }, [recentSends]);

  const QUICK_AMOUNTS = useMemo(() => {
    return activeAccount?.currency === "USD" ? [10, 25, 50, 100, 250] : [500, 1000, 2000, 5000, 10000];
  }, [activeAccount]);

  return (
    <div className="flex flex-col gap-8 max-w-[1400px] mx-auto w-full relative">
      
      {/* Background radial glow */}
      <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 px-2 relative z-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Peer Transfers
          </div>
          <h1 className="text-4xl font-black text-[--text-primary] tracking-tight sm:text-5xl">
            Family & <span className="text-gradient">Friends</span>
          </h1>
          <p className="text-sm mt-2 text-[--text-secondary] max-w-xl">
            Monitor household contacts, manage P2P recipients, and disburse capital securely across multiple global currencies.
          </p>
        </div>
        <button
          onClick={() => { setIsAddingRecipient(true); setIsEditingRecipient(false); setNewName(""); }}
          className="bg-gradient-to-r from-indigo-500 to-sky-500 hover:shadow-lg hover:shadow-indigo-500/25 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {/* Modern Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative z-10">
        <div className="glass-card-static flex items-center justify-between p-6 hover:border-indigo-500/20 transition-colors">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Total Contacts</p>
            <p className="text-3xl font-[900] text-white [font-family:var(--font-display)]">{recipients.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
        </div>
        
        <div className="glass-card-static flex items-center justify-between p-6 hover:border-purple-500/20 transition-colors">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Family Circle</p>
            <p className="text-3xl font-[900] text-white [font-family:var(--font-display)]">
              {recipients.filter(r => r.relationship === "Family").length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-card-static flex items-center justify-between p-6 hover:border-emerald-500/20 transition-colors">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-[--text-muted]">Recently Disbursed</p>
            <p className="text-3xl font-[900] text-emerald-400 [font-family:var(--font-display)]">
              ₹{totalSent.toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <Send className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs & History View Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 relative z-10">
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(["All", "Family", "Friend", "Other"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeFilter === tab 
                  ? "bg-[--accent-primary] text-white shadow-lg shadow-[--accent-primary]/25" 
                  : "bg-white/[0.02] text-[--text-muted] hover:bg-white/5 border border-white/5 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="flex bg-white/5 p-1 rounded-xl w-fit border border-white/5">
          <button
            onClick={() => setActiveView("contacts")}
            className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === "contacts" ? "bg-white/10 text-white" : "text-[--text-muted] hover:text-white"}`}
          >
            Contacts ({recipients.length})
          </button>
          <button
            onClick={() => setActiveView("history")}
            className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === "history" ? "bg-white/10 text-white" : "text-[--text-muted] hover:text-white"}`}
          >
            History ({recentSends.length})
          </button>
        </div>
      </div>

      {/* Main View Render */}
      <AnimatePresence mode="wait">
        {activeView === "contacts" ? (
          <motion.div 
            key="contacts-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10"
          >
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[210px] bg-white/[0.01] border border-white/5 rounded-3xl animate-pulse" />
              ))
            ) : filteredRecipients.length === 0 ? (
              <div className="col-span-full py-20 text-center glass-card-static border-dashed flex flex-col items-center justify-center gap-3">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-slate-500 mb-2">
                   <Users className="w-6 h-6" />
                </div>
                <p className="text-lg font-bold text-white">
                  {activeFilter === "All" ? "No contacts established" : `No ${activeFilter.toLowerCase()} contacts found`}
                </p>
                <p className="text-xs text-[--text-muted] max-w-sm mx-auto">
                  Create a secure contact node to begin transferring capital.
                </p>
              </div>
            ) : (
              filteredRecipients.map((person) => {
                const theme = getTheme(person.relationship);
                return (
                  <div 
                    key={person.id} 
                    className={`group rounded-3xl p-6 transition-all duration-300 relative overflow-hidden shadow-xl hover:-translate-y-1 ${theme.gradient}`}
                  >
                    {/* Glass shine on hover */}
                    <div className="absolute top-0 right-0 w-2/3 h-full bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none transform -skew-x-12 group-hover:from-white/[0.04] transition-all" />

                    {/* Card Top: Chip & Edit */}
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3.5">
                        {/* Metallic card chip */}
                        <div className="w-8 h-6 rounded-[4px] relative overflow-hidden border shadow-inner border-white/15 bg-amber-400/20" />
                        <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${theme.badge}`}>
                          {person.relationship || "Other"}
                        </span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => startEdit(person)} 
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                          title="Edit Contact"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRecipient(person.id)} 
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors"
                          title="Delete Contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Middle: Name */}
                    <div className="space-y-1 mb-8">
                      <h3 className="text-xl font-black text-white tracking-wide truncate">{person.name}</h3>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                        ADDED: {person.created_at ? format(new Date(person.created_at), "dd MMM yyyy") : "N/A"}
                      </p>
                    </div>
                    
                    {/* Card Bottom: Send Money Button */}
                    <button
                      onClick={() => { setSelectedRecipient(person); setSendAmount(""); setSendNote(""); setIsSendingMoney(true); }}
                      className="w-full h-11 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-white/5 border border-white/5 text-white hover:bg-white/10 hover:border-white/15"
                    >
                      <Send className="w-3 h-3 text-indigo-400" />
                      Disburse Money
                    </button>
                  </div>
                );
              })
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="history-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="glass-card-static p-0 overflow-hidden relative z-10 animate-fade-in"
          >
            <div className="px-6 py-5 border-b border-white/5 bg-white/[0.01]">
              <h3 className="text-xs font-black uppercase tracking-widest text-[--text-muted]">Recent Transfers Log</h3>
            </div>
            <div className="divide-y divide-white/5">
              {recentSends.length === 0 ? (
                 <div className="py-16 text-center text-xs font-bold uppercase tracking-widest text-[--text-muted] italic">No transaction logs available.</div>
              ) : (
                recentSends.map((send) => (
                  <div key={send.id} className="px-6 py-5 flex items-center justify-between hover:bg-white/[0.01] transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/5 border border-rose-500/10 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white group-hover:text-rose-400 transition-colors">{send.details || "Disbursement Outflow"}</p>
                        <p className="text-[9px] font-black uppercase text-[--text-muted] tracking-wider mt-1">
                          {send.created_at ? format(new Date(send.created_at), "dd MMM yyyy • hh:mm a") : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-black tabular-nums text-rose-400">-₹{(send.amount || 0).toLocaleString()}</p>
                      <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">SUCCESS</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit Contact Modal */}
      <AnimatePresence>
        {isAddingRecipient && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card-static max-w-md w-full p-8 shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider">{isEditingRecipient ? "Edit Contact" : "Add Contact"}</h2>
                  <p className="text-[10px] text-[--text-muted] mt-1 uppercase tracking-widest">Secure passbook directory node</p>
                </div>
                <button onClick={() => { setIsAddingRecipient(false); setIsEditingRecipient(false); setEditingRecipient(null); setNewName(""); }} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddRecipient} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Full Name</label>
                  <input required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-indigo-500 outline-none transition-all placeholder-white/10" placeholder="e.g. Priya Sharma" />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Relationship Group</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(["Family", "Friend", "Other"] as const).map((rel) => {
                      const isActive = newRelationship === rel;
                      return (
                        <button key={rel} type="button" onClick={() => setNewRelationship(rel)} className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isActive ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-white/[0.02] text-[--text-muted] hover:bg-white/5 border border-white/5'}`}>
                          {rel}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => { setIsAddingRecipient(false); setIsEditingRecipient(false); setEditingRecipient(null); setNewName(""); }} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-sky-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                    {isEditingRecipient ? "Save Details" : "Register Node"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fast Transfer Visual Numpad Modal */}
      <AnimatePresence>
        {isSendingMoney && selectedRecipient && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card-static max-w-sm w-full p-6 shadow-2xl relative"
            >
              <button onClick={() => { setIsSendingMoney(false); setSelectedRecipient(null); }} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-2 mb-6">
                <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-lg font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {selectedRecipient.name.charAt(0)}
                </div>
                <h2 className="text-base font-black text-white uppercase tracking-wider">Fast Transfer</h2>
                <p className="text-[10px] text-[--text-muted] uppercase tracking-widest">Disbursing to {selectedRecipient.name}</p>
              </div>

              <form onSubmit={handleSendMoneySubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Debit Source Account</label>
                  <select required value={sendAccountId} onChange={(e) => setSendAccountId(e.target.value)} className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer">
                    {accounts.map((acc) => (<option key={acc.id} value={acc.id} className="bg-neutral-950 text-white">{acc.name} ({acc.currency} {acc.balance.toLocaleString()})</option>))}
                  </select>
                </div>

                <div className="space-y-1 text-center">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Transfer Capital</label>
                  <div className="text-3xl font-black font-mono text-emerald-400 mt-2">
                    {currencySymbol}{sendAmount || "0.00"}
                  </div>
                  
                  {/* Quick-Amounts Suggestion Chips */}
                  <div className="flex gap-1.5 mt-3 justify-center flex-wrap">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button 
                        key={amt} 
                        type="button" 
                        onClick={() => setSendAmount(amt.toString())} 
                        className={`px-3 py-1 rounded-full text-[9px] font-black tracking-wider transition-all border ${sendAmount === amt.toString() ? 'bg-indigo-500 border-indigo-500 text-white shadow-md' : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
                      >
                        {currencySymbol}{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Note (Optional)</label>
                  <input value={sendNote} onChange={(e) => setSendNote(e.target.value)} className="w-full bg-neutral-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none placeholder-white/10" placeholder="e.g. Monthly Pocket Cash" />
                </div>

                {/* Virtual Keypad */}
                <div className="grid grid-cols-3 gap-1.5 pt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, ".", 0, "⌫"].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        if (val === "⌫") {
                          setSendAmount(prev => prev.slice(0, -1));
                        } else if (val === ".") {
                          if (!sendAmount.includes(".")) setSendAmount(prev => prev + val);
                        } else {
                          setSendAmount(prev => prev + val);
                        }
                      }}
                      className="h-9 rounded-xl bg-white/[0.01] border border-white/5 active:bg-white/10 hover:border-white/15 text-xs font-bold text-white transition-all active:scale-95 flex items-center justify-center"
                    >
                      {val}
                    </button>
                  ))}
                </div>

                <div className="pt-2">
                  <button 
                    type="submit" 
                    disabled={sending || !sendAmount} 
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:shadow-lg hover:shadow-emerald-500/25 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]"
                  >
                    {sending ? (
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      `Verify & Transfer`
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card-static max-w-sm w-full p-6 text-center shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center mb-5 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">Remove Node?</h3>
              <p className="text-xs text-[--text-secondary] mb-6 leading-relaxed">
                This will permanently delete <span className="text-white font-bold">{recipients.find(r => r.id === deletingId)?.name}</span> from your household passbook.
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={() => { setShowDeleteConfirm(false); setDeletingId(null); }} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Remove Node</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
