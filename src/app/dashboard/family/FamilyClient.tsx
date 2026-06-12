"use client";

import React, { useEffect, useState, useMemo } from "react";
import { createRecipient, deleteRecipient, sendMoneyToFamily, updateRecipient } from "./actions";
import { toast } from "react-hot-toast";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { Plus, Users, Search, Edit2, Trash2, X, Send, History, Wallet, ArrowUpRight, CheckCircle2 } from "lucide-react";

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

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

  const recentSends = ledgerLogs
    .filter((log) => log.action_type === "SEND_MONEY" && (!selectedHistoryRecipient || log.source_id === selectedHistoryRecipient))
    .slice(0, 20);

  const totalSent = recentSends.reduce((sum, s) => sum + (s.amount || 0), 0);

  return (
    <div className="flex flex-col gap-8 max-w-[1200px] mx-auto w-full pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Transfers & Contacts</h1>
          <p className="text-sm text-[--text-muted] mt-1">Manage family members and execute secure transfers.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingRecipient(true)}
            className="bg-[--accent-primary] hover:bg-[--accent-primary]/90 text-white flex items-center gap-2 px-4 py-2.5 rounded-md font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Contact
          </button>
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#111111] border border-white/10 p-5 rounded-md flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[--text-muted] font-semibold">Total Contacts</span>
          <span className="text-2xl font-bold text-white">{recipients.length}</span>
        </div>
        <div className="bg-[#111111] border border-white/10 p-5 rounded-md flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wider text-[--text-muted] font-semibold">Recent Volume (INR)</span>
          <span className="text-2xl font-bold text-white">₹{totalSent.toLocaleString()}</span>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-col gap-6">
        {/* TAB NAVIGATION */}
        <div className="flex items-center gap-6 border-b border-white/10">
          <button
            onClick={() => setActiveView("contacts")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeView === "contacts" ? "border-[--accent-primary] text-[--accent-primary]" : "border-transparent text-[--text-muted] hover:text-white"}`}
          >
            Directory
          </button>
          <button
            onClick={() => { setActiveView("history"); setSelectedHistoryRecipient(null); }}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${activeView === "history" ? "border-[--accent-primary] text-[--accent-primary]" : "border-transparent text-[--text-muted] hover:text-white"}`}
          >
            Transaction History
          </button>
        </div>

        {/* TAB: CONTACTS */}
        {activeView === "contacts" && (
          <div className="bg-[#111111] border border-white/10 rounded-md overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-[#151515] flex flex-col sm:flex-row justify-between gap-4 items-center">
              <h2 className="text-sm font-semibold text-white">Contact List</h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-sm text-sm text-white placeholder:text-white/40 focus:border-[--accent-primary] outline-none"
                />
              </div>
            </div>

            <div className="p-4 bg-[#111111]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-[#151515] border border-white/10 rounded-md h-[160px] animate-pulse"></div>
                  ))
                ) : filteredRecipients.length === 0 ? (
                  <div className="col-span-full py-12 text-center">
                    <p className="text-[--text-primary] font-medium">No contacts found</p>
                    <p className="text-xs text-[--text-muted] mt-1">Try a different search or add a new contact.</p>
                  </div>
                ) : (
                  filteredRecipients.map((person) => (
                    <div key={person.id} className="bg-[#151515] border border-white/10 rounded-md p-5 flex flex-col justify-between hover:border-[--accent-primary]/50 transition-colors group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1a1a1a] border border-white/5 text-white flex items-center justify-center font-bold text-lg shadow-inner">
                            {person.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-white leading-tight">{person.name}</span>
                            <span className="text-xs text-[--text-muted] mt-0.5">Total: ₹{(recipientTotals[person.id] || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(person)} className="p-1.5 text-[--text-muted] hover:text-white transition-colors rounded hover:bg-white/5" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteRecipient(person.id)} className="p-1.5 text-[--text-muted] hover:text-danger transition-colors rounded hover:bg-white/5" title="Remove">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => { setSelectedRecipient(person); setIsSendingMoney(true); }}
                          className="flex-1 inline-flex justify-center items-center gap-1.5 py-2 bg-[--accent-primary] hover:bg-[--accent-primary]/90 rounded-sm text-xs font-medium text-white transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" /> Send
                        </button>
                        <button
                          onClick={() => { setSelectedHistoryRecipient(person.id); setActiveView("history"); }}
                          className="flex-1 inline-flex justify-center items-center gap-1.5 py-2 bg-[#1e1e1e] hover:bg-[#2a2a2a] border border-white/10 rounded-sm text-xs font-medium text-white transition-colors"
                        >
                          <History className="w-3.5 h-3.5" /> History
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: HISTORY */}
        {activeView === "history" && (
          <div className="bg-[#111111] border border-white/10 rounded-md overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-[#151515] flex justify-between items-center">
              <h2 className="text-sm font-semibold text-white">
                {selectedHistoryRecipient ? `Transactions: ${recipients.find(r => r.id === selectedHistoryRecipient)?.name}` : "Recent Transactions"}
              </h2>
              {selectedHistoryRecipient && (
                <button onClick={() => setSelectedHistoryRecipient(null)} className="text-xs font-medium text-[--text-muted] hover:text-white flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear Filter
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[--text-secondary]">
                <thead className="text-xs uppercase bg-[#181818] text-[--text-muted] border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date & Time</th>
                    <th className="px-6 py-4 font-semibold">Details</th>
                    <th className="px-6 py-4 font-semibold text-right">Amount</th>
                    <th className="px-6 py-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentSends.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-[--text-muted]">No transactions found.</td>
                    </tr>
                  ) : (
                    recentSends.map((send) => (
                      <tr key={send.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-white">{send.created_at ? format(new Date(send.created_at), "MMM dd, yyyy") : "—"}</span>
                          <span className="text-xs text-[--text-muted] ml-2 block sm:inline">{send.created_at ? format(new Date(send.created_at), "h:mm a") : ""}</span>
                        </td>
                        <td className="px-6 py-4 font-medium text-white">
                          {send.details || "Transfer"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-semibold text-danger">-₹{(send.amount || 0).toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded">
                            <CheckCircle2 className="w-3 h-3" /> Completed
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {(isAddingRecipient || isSendingMoney || showDeleteConfirm) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80">
          
          {/* DELETE MODAL */}
          {showDeleteConfirm && (
            <div className="bg-[#111111] border border-white/10 rounded-md w-full max-w-sm p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Delete Contact</h3>
              <p className="text-sm text-[--text-secondary] mb-6">
                Are you sure you want to remove <span className="text-white font-medium">{recipients.find(r => r.id === deletingId)?.name}</span>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={closeModals} className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-md text-sm font-medium text-white transition-colors">Cancel</button>
                <button onClick={confirmDelete} disabled={submitting} className="px-4 py-2 bg-danger hover:bg-danger/90 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50">
                  {submitting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          )}

          {/* ADD/EDIT MODAL */}
          {isAddingRecipient && !showDeleteConfirm && (
            <div className="bg-[#111111] border border-white/10 rounded-md w-full max-w-md shadow-2xl">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                  {isEditingRecipient ? "Edit Contact" : "Add New Contact"}
                </h2>
                <button onClick={closeModals} className="text-[--text-muted] hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddRecipient} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[--text-secondary] mb-1.5">Full Name</label>
                  <input autoFocus required type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-[#1a1a1a] border border-white/10 rounded-md px-3 py-2 text-white focus:border-[--accent-primary] outline-none text-sm" placeholder="Enter contact name" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModals} className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-md text-sm font-medium text-white transition-colors">Cancel</button>
                  <button type="submit" disabled={submitting || !newName.trim()} className="px-4 py-2 bg-[--accent-primary] hover:bg-[--accent-primary]/90 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50">
                    {submitting ? "Saving..." : "Save Details"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SEND MONEY MODAL */}
          {isSendingMoney && !showDeleteConfirm && selectedRecipient && (
            <div className="bg-[#111111] border border-white/10 rounded-md w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-bold text-white">Transfer Funds</h2>
                <button onClick={closeModals} className="text-[--text-muted] hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSendMoney} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="bg-[#1a1a1a] border border-white/5 p-4 rounded-md flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[--accent-primary]/20 text-[--accent-primary] flex items-center justify-center font-bold">
                    {selectedRecipient.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs text-[--text-muted] uppercase tracking-wider font-semibold">Recipient</p>
                    <p className="text-sm font-bold text-white">{selectedRecipient.name}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--text-secondary] mb-1.5">Source Account</label>
                  <select required value={sendAccountId} onChange={(e) => setSendAccountId(e.target.value)} className="w-full bg-[#1a1a1a] border border-white/10 rounded-md px-3 py-2 text-white focus:border-[--accent-primary] outline-none text-sm appearance-none cursor-pointer">
                    {accounts.map((acc) => (<option key={acc.id} value={acc.id} className="bg-[#1a1a1a]">{acc.name} ({acc.currency} {acc.balance.toLocaleString()})</option>))}
                  </select>
                  {sendAccountId && accounts.find(a => a.id === sendAccountId) && (
                    <p className="text-xs text-[--text-muted] mt-2">
                      Available: <span className="font-semibold text-white">{accounts.find(a => a.id === sendAccountId)?.currency === 'USD' ? '$' : '₹'}{accounts.find(a => a.id === sendAccountId)?.balance.toLocaleString()}</span>
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[--text-secondary] mb-1.5">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-muted]">
                      {accounts.find(a => a.id === sendAccountId)?.currency === 'USD' ? '$' : '₹'}
                    </span>
                    <input autoFocus required type="number" step="0.01" min="1" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} className="w-full bg-[#1a1a1a] border border-white/10 rounded-md pl-8 pr-3 py-2 text-lg font-semibold text-white focus:border-[--accent-primary] outline-none text-sm" placeholder="0.00" />
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button key={amt} type="button" onClick={() => setSendAmount(amt.toString())} className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${sendAmount === amt.toString() ? 'bg-[--accent-primary] text-white' : 'bg-[#1a1a1a] border border-white/10 text-[--text-muted] hover:text-white'}`}>
                        +{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--text-secondary] mb-1.5">Note (Optional)</label>
                  <input value={sendNote} onChange={(e) => setSendNote(e.target.value)} className="w-full bg-[#1a1a1a] border border-white/10 rounded-md px-3 py-2 text-white focus:border-[--accent-primary] outline-none text-sm" placeholder="Description" />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <button type="button" onClick={closeModals} className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-md text-sm font-medium text-white transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting || !sendAmount} className="px-6 py-2 bg-[--accent-primary] hover:bg-[--accent-primary]/90 rounded-md text-sm font-medium text-white transition-colors flex items-center gap-2 disabled:opacity-50">
                    {submitting ? "Processing..." : <><ArrowUpRight className="w-4 h-4" /> Transfer</>}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
