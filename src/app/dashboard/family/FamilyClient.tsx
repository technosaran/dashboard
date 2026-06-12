"use client";

import React, { useEffect, useState, useMemo } from "react";
import { createRecipient, deleteRecipient, sendMoneyToFamily, updateRecipient } from "./actions";
import { toast } from "react-hot-toast";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, Search, Edit2, Trash2, X, Send, History, Wallet, ArrowUpRight, CheckCircle2 } from "lucide-react";

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

const RELATIONSHIP_CONFIG: Record<string, { color: string; soft: string }> = {
  Family: { color: "#a29bfe", soft: "rgba(162, 155, 254, 0.16)" },
};

// Colors for PieChart
const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

interface FamilyClientProps {
  initialData?: FinanceData;
}

export default function FamilyClient({
  initialData,
}: FamilyClientProps) {
  const { data: { profile, recipients, accounts, ledgerLogs }, mutate, isLoading } = useFinanceData(initialData);
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [isSendingMoney, setIsSendingMoney] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any | null>(null);
  const [submitting, withLock] = useSubmitLock();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"contacts" | "history">("contacts");
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<any | null>(null);
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  
  // Member specific history
  const [selectedHistoryRecipient, setSelectedHistoryRecipient] = useState<string | null>(null);

  // Form states
  const [newName, setNewName] = useState("");
  const [newRelationship] = useState("Family");

  const [sendAmount, setSendAmount] = useState("");
  const [sendAccountId, setSendAccountId] = useState("");
  const [sendNote, setSendNote] = useState("");

  useEffect(() => {
    if (accounts.length > 0 && !sendAccountId) {
      const defaultAccId = profile?.settings?.default_accounts?.family;
      const defaultAccExists = defaultAccId && accounts.some(a => a.id === defaultAccId);
      setTimeout(() => {
        setSendAccountId(defaultAccExists ? defaultAccId : accounts[0].id);
      }, 0);
    }
  }, [accounts, sendAccountId, profile]);

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
          closeModals();
          mutate();
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
        closeModals();
        toast.success(`${newName} added to contacts`);
        mutate();
      } else {
        toast.error(res.error || "Failed to add recipient");
      }
    });
  };

  const closeModals = () => {
    setIsAddingRecipient(false);
    setIsEditingRecipient(false);
    setEditingRecipient(null);
    setNewName("");
    setIsSendingMoney(false);
    setSelectedRecipient(null);
    setSendAmount("");
    setSendNote("");
    setShowDeleteConfirm(false);
    setDeletingId(null);
  };

  const startEdit = (person: any) => {
    setEditingRecipient(person);
    setNewName(person.name);
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
        mutate();
      } else {
        toast.error(res.error || "Failed to remove contact");
      }
      closeModals();
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
        closeModals();
        toast.success(`₹${amount.toLocaleString()} sent to ${selectedRecipient.name}`);
        mutate();
      } else {
        toast.error(res.error || "Failed to send money");
      }
    });
  };

  const getConfig = (rel?: string | null) => {
    return RELATIONSHIP_CONFIG.Family;
  };

  // Analytics
  const recipientTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    recipients.forEach(r => totals[r.id] = 0);
    ledgerLogs.forEach(log => {
      if (log.action_type === "SEND_MONEY" && log.source_id && totals[log.source_id] !== undefined) {
        totals[log.source_id] += Number(log.amount || 0);
      }
    });
    return totals;
  }, [ledgerLogs, recipients]);

  const filteredRecipients = useMemo(() => {
    return recipients.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [recipients, searchQuery]);

  const frequentContacts = useMemo(() => {
    return [...recipients].sort((a, b) => (recipientTotals[b.id] || 0) - (recipientTotals[a.id] || 0)).slice(0, 4);
  }, [recipients, recipientTotals]);

  const pieData = useMemo(() => {
    return recipients.map(r => ({
      name: r.name,
      value: recipientTotals[r.id] || 0
    })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  }, [recipients, recipientTotals]);

  const recentSends = ledgerLogs
    .filter((log) => log.action_type === "SEND_MONEY" && (!selectedHistoryRecipient || log.source_id === selectedHistoryRecipient))
    .slice(0, 15);

  const totalSent = recentSends.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <div className="flex flex-col gap-8 max-w-[1400px] mx-auto w-full">
      {/* Header section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-5"
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[--text-primary]">Family Hub</h1>
          <p className="text-sm mt-1.5 text-[--text-muted]">Manage your family contacts and transfer capital instantly.</p>
        </div>
        <button
          onClick={() => setIsAddingRecipient(true)}
          className="bg-white/[0.05] hover:bg-white/[0.1] text-[--text-primary] border border-white/[0.05] flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl transition-all font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Stats and Quick Access */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-1 flex flex-col gap-6"
        >
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.05] rounded-3xl p-5 flex flex-col gap-1 shadow-lg shadow-black/20">
              <p className="text-xs font-medium text-[--text-muted]">Total Members</p>
              <p className="text-3xl font-semibold text-[--text-primary] mt-1">{recipients.length}</p>
            </div>
            <div className="bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.05] rounded-3xl p-5 flex flex-col gap-1 shadow-lg shadow-black/20">
              <p className="text-xs font-medium text-[--text-muted]">Recent Volume</p>
              <p className="text-3xl font-semibold text-[--accent-primary-light] mt-1">
                ₹{totalSent.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Frequent Contacts */}
          {frequentContacts.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6">
              <h3 className="text-sm font-medium text-[--text-primary] mb-4">Frequent Contacts</h3>
              <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
                {frequentContacts.map((person) => {
                  const config = getConfig(person.relationship);
                  return (
                    <button
                      key={`freq-${person.id}`}
                      onClick={() => { setSelectedRecipient(person); setIsSendingMoney(true); }}
                      className="flex flex-col items-center gap-2 min-w-[72px] group"
                    >
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-medium relative transition-transform group-hover:scale-105"
                           style={{ backgroundColor: config.soft, color: config.color }}>
                        {person.name.charAt(0).toUpperCase()}
                        <div className="absolute -bottom-1 -right-1 bg-[#121212] rounded-full p-1 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Send className="w-3 h-3 text-[--text-primary]" />
                        </div>
                      </div>
                      <span className="text-xs font-medium text-[--text-muted] group-hover:text-[--text-primary] transition-colors truncate w-full text-center">
                        {person.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Distribution */}
          {pieData.length > 0 && (
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 hidden lg:block">
              <h3 className="text-sm font-medium text-[--text-primary] mb-6">Funds Distribution</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `₹${Number(value).toLocaleString()}`} contentStyle={{ backgroundColor: '#171717', borderColor: '#333', borderRadius: '12px' }} itemStyle={{ color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {pieData.slice(0, 3).map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span className="text-xs text-[--text-muted] truncate max-w-[120px]">{entry.name}</span>
                    </div>
                    <span className="text-xs font-medium text-[--text-primary]">₹{entry.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Right Column: Main Content Area */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
          className="lg:col-span-2 flex flex-col gap-6"
        >
          {/* View Toggles & Search */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.02] border border-white/[0.05] rounded-xl text-sm text-[--text-primary] placeholder:text-white/30 focus:border-[--accent-primary] focus:ring-1 focus:ring-[--accent-primary] outline-none transition-all"
              />
            </div>
            
            <div className="flex p-1 bg-white/[0.02] border border-white/[0.05] rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setActiveView("contacts")}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-medium transition-all ${activeView === "contacts" ? "bg-white/[0.08] text-[--text-primary] shadow-sm" : "text-[--text-muted] hover:text-[--text-primary]"}`}
              >
                Contacts
              </button>
              <button
                onClick={() => { setActiveView("history"); setSelectedHistoryRecipient(null); }}
                className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-medium transition-all ${activeView === "history" ? "bg-white/[0.08] text-[--text-primary] shadow-sm" : "text-[--text-muted] hover:text-[--text-primary]"}`}
              >
                Timeline
              </button>
            </div>
          </div>

          {/* Contacts Grid */}
          {activeView === "contacts" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <motion.div key={`skeleton-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-32 bg-white/[0.02] border border-white/[0.05] rounded-3xl animate-pulse" />
                  ))
                ) : filteredRecipients.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-20 text-center flex flex-col items-center justify-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white/[0.02] flex items-center justify-center text-white/20">
                      <Search className="w-8 h-8" />
                    </div>
                    <p className="text-lg font-medium text-[--text-primary]">No contacts found</p>
                    <p className="text-sm text-[--text-muted] max-w-sm">Try adjusting your search query or add a new family member.</p>
                  </motion.div>
                ) : (
                  filteredRecipients.map((person) => {
                    const config = getConfig(person.relationship);
                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
                        key={person.id}
                        className="group relative bg-gradient-to-br from-white/[0.03] to-white/[0.01] hover:from-white/[0.05] hover:to-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] rounded-3xl p-5 transition-all flex flex-col"
                      >
                        {/* Action Menu - absolute top right */}
                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(person)} className="p-1.5 text-[--text-muted] hover:text-[--text-primary] rounded-full hover:bg-white/[0.05] transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteRecipient(person.id)} className="p-1.5 text-[--text-muted] hover:text-danger rounded-full hover:bg-white/[0.05] transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>

                        <div className="flex items-center gap-4 mb-5">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium shadow-inner" style={{ backgroundColor: config.soft, color: config.color }}>
                            {person.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-[--text-primary] leading-tight">{person.name}</h3>
                            <p className="text-xs text-[--text-muted] mt-0.5">Family Member</p>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-auto pt-4 border-t border-white/[0.05]">
                          <button
                            onClick={() => { setSelectedRecipient(person); setIsSendingMoney(true); }}
                            className="flex-1 py-2.5 rounded-xl text-xs font-medium bg-[--accent-primary]/10 hover:bg-[--accent-primary]/20 text-[--accent-primary-light] border border-[--accent-primary]/20 transition-all flex items-center justify-center gap-2"
                          >
                            <Send className="w-3.5 h-3.5" /> Send
                          </button>
                          <button
                            onClick={() => { setSelectedHistoryRecipient(person.id); setActiveView("history"); }}
                            className="flex-none px-4 py-2.5 rounded-xl text-xs font-medium bg-white/[0.03] hover:bg-white/[0.06] text-[--text-muted] hover:text-[--text-primary] border border-white/[0.05] transition-all flex items-center justify-center"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          )}

          {/* History Timeline */}
          {activeView === "history" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-semibold text-[--text-primary]">
                  {selectedHistoryRecipient ? `Activity with ${recipients.find(r => r.id === selectedHistoryRecipient)?.name}` : "Recent Activity"}
                </h3>
                {selectedHistoryRecipient && (
                  <button onClick={() => setSelectedHistoryRecipient(null)} className="text-xs font-medium text-[--text-muted] hover:text-[--text-primary] flex items-center gap-1 transition-colors">
                    <X className="w-3 h-3" /> Clear Filter
                  </button>
                )}
              </div>

              <div className="relative pl-4 space-y-8 before:absolute before:inset-0 before:left-[27px] before:w-[2px] before:bg-white/[0.05] before:-z-10">
                {recentSends.length === 0 ? (
                  <div className="py-10 text-center text-sm text-[--text-muted]">No activity found.</div>
                ) : (
                  recentSends.map((send, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      key={send.id} className="relative flex items-start gap-6 group"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#121212] border-4 border-[#121212] flex items-center justify-center shrink-0 z-10 mt-0.5">
                         <div className="w-2.5 h-2.5 rounded-full bg-[--accent-primary-light]" />
                      </div>
                      <div className="flex-1 bg-white/[0.02] group-hover:bg-white/[0.04] border border-white/[0.05] rounded-2xl p-4 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-[--text-primary]">{send.details || "Transfer"}</p>
                            <p className="text-xs text-[--text-muted] mt-1">{send.created_at ? format(new Date(send.created_at), "MMMM d, yyyy 'at' h:mm a") : "—"}</p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-base font-semibold text-[--text-primary]">-₹{(send.amount || 0).toLocaleString()}</p>
                            <p className="text-xs text-success flex items-center gap-1 mt-1 sm:justify-end">
                              <CheckCircle2 className="w-3 h-3" /> Completed
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Unified Modal Overlay for Add/Edit/Send/Delete */}
      <AnimatePresence>
        {(isAddingRecipient || isSendingMoney || showDeleteConfirm) && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
          >
            {/* Delete Modal */}
            {showDeleteConfirm && (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0f0f0f] border border-white/[0.08] rounded-3xl w-full max-w-sm p-8 text-center shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-danger/50" />
                <div className="w-16 h-16 rounded-full bg-danger/10 text-danger mx-auto flex items-center justify-center mb-6">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-[--text-primary] mb-2">Remove Contact?</h3>
                <p className="text-sm text-[--text-muted] mb-8 leading-relaxed">
                  This will permanently remove <span className="text-[--text-primary] font-medium">{recipients.find(r => r.id === deletingId)?.name}</span> from your family hub. Past transactions will remain in your history.
                </p>
                <div className="flex gap-3 w-full">
                  <button onClick={closeModals} className="flex-1 py-3.5 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl text-sm font-medium transition-all text-[--text-primary]">Cancel</button>
                  <button onClick={confirmDelete} disabled={submitting} className="bg-danger hover:bg-danger/90 text-white flex-1 py-3.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center">
                    {submitting ? "Removing..." : "Remove"}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Add/Edit Modal */}
            {isAddingRecipient && !showDeleteConfirm && (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[#0f0f0f] border border-white/[0.08] rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-semibold text-[--text-primary] flex items-center gap-2">
                    {isEditingRecipient ? <Edit2 className="w-5 h-5 text-[--accent-primary]" /> : <Users className="w-5 h-5 text-[--accent-primary]" />}
                    {isEditingRecipient ? "Edit Contact" : "Add Family Member"}
                  </h2>
                  <button onClick={closeModals} className="p-2 text-[--text-muted] hover:text-[--text-primary] transition-colors rounded-full hover:bg-white/5">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddRecipient} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-[--text-secondary] mb-2">Full Name</label>
                    <input autoFocus required type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[--text-primary] focus:border-[--accent-primary] focus:bg-white/[0.04] outline-none transition-all placeholder-white/20" placeholder="e.g., Jane Doe" />
                  </div>
                  <div className="pt-2 flex gap-3">
                    <button type="button" onClick={closeModals} className="flex-1 py-3.5 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl text-sm font-medium transition-all text-[--text-primary]">Cancel</button>
                    <button type="submit" disabled={submitting || !newName.trim()} className="bg-[--accent-primary] hover:bg-[--accent-primary]/90 text-white flex-[2] py-3.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center">
                      {submitting ? "Saving..." : "Save Contact"}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Send Money Modal */}
            {isSendingMoney && !showDeleteConfirm && selectedRecipient && (
              <motion.div 
                initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                className="bg-[#0f0f0f] border border-white/[0.08] rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
              >
                <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium shadow-inner" style={{ backgroundColor: getConfig(selectedRecipient.relationship).soft, color: getConfig(selectedRecipient.relationship).color }}>
                        {selectedRecipient.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-[--text-primary]">Send Capital</h2>
                        <p className="text-sm text-[--text-muted] mt-0.5">To {selectedRecipient.name}</p>
                      </div>
                    </div>
                    <button onClick={closeModals} className="p-2 text-[--text-muted] hover:text-[--text-primary] transition-colors rounded-full hover:bg-white/5 bg-white/[0.02]">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSendMoney} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-[--text-secondary] mb-2 flex items-center gap-2">
                        <Wallet className="w-4 h-4" /> From Account
                      </label>
                      <select required value={sendAccountId} onChange={(e) => setSendAccountId(e.target.value)} className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-4 text-[--text-primary] focus:border-[--accent-primary] outline-none transition-all appearance-none cursor-pointer">
                        {accounts.map((acc) => (<option key={acc.id} value={acc.id} className="bg-[#121212]">{acc.name} ({acc.currency} {acc.balance.toLocaleString()})</option>))}
                      </select>
                      {sendAccountId && accounts.find(a => a.id === sendAccountId) && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 px-3 py-2.5 rounded-lg bg-[--accent-primary]/5 border border-[--accent-primary]/10 flex items-center justify-between text-xs">
                          <span className="text-[--text-muted]">Available Balance</span>
                          <span className="font-semibold text-[--accent-primary-light]">
                            {accounts.find(a => a.id === sendAccountId)?.currency === 'USD' ? '$' : '₹'}
                            {accounts.find(a => a.id === sendAccountId)?.balance.toLocaleString()}
                          </span>
                        </motion.div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-[--text-secondary] mb-2">Amount</label>
                      <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-[--text-muted] group-focus-within:text-[--text-primary] transition-colors">
                          {accounts.find(a => a.id === sendAccountId)?.currency === 'USD' ? '$' : '₹'}
                        </span>
                        <input autoFocus required type="number" step="0.01" min="1" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} className="w-full bg-white/[0.02] border border-white/[0.08] rounded-2xl pl-12 pr-4 py-5 text-3xl font-semibold text-[--text-primary] focus:border-[--accent-primary] focus:bg-white/[0.04] outline-none transition-all placeholder-white/10" placeholder="0" />
                      </div>
                      <div className="flex gap-2 mt-3 overflow-x-auto pb-1 custom-scrollbar">
                        {QUICK_AMOUNTS.map((amt) => (
                          <button key={amt} type="button" onClick={() => setSendAmount(amt.toString())} className={`flex-none px-4 py-2 rounded-xl text-xs font-medium transition-all ${sendAmount === amt.toString() ? 'bg-[--accent-primary] text-white' : 'bg-white/[0.03] border border-white/[0.08] text-[--text-muted] hover:bg-white/[0.08]'}`}>
                            +₹{amt.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[--text-secondary] mb-2">Note</label>
                      <input value={sendNote} onChange={(e) => setSendNote(e.target.value)} className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[--text-primary] focus:border-[--accent-primary] focus:bg-white/[0.04] outline-none transition-all placeholder-white/20" placeholder="What's this for?" />
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button type="button" onClick={closeModals} className="flex-1 py-4 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl text-sm font-medium transition-all text-[--text-primary]">
                        Cancel
                      </button>
                      <button type="submit" disabled={submitting || !sendAmount} className="bg-[--accent-primary] hover:bg-[--accent-primary]/90 text-white flex-[2] py-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {submitting ? "Processing..." : <><ArrowUpRight className="w-4 h-4" /> Send Now</>}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
