"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createRecipient, deleteRecipient, sendMoneyToFamily, updateRecipient } from "./actions";
import { toast } from "react-hot-toast";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { format } from "date-fns";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { Plus, Edit2, Trash2, X, Send, History, ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import { Drawer } from "@/components/ui/drawer";
import dynamic from "next/dynamic";
import { getChartColour } from "@/lib/chart-colours";

import { PieChart, Pie, Cell, Tooltip } from "recharts";

const ResponsiveContainer = dynamic(() => import("recharts").then(mod => mod.ResponsiveContainer), { ssr: false });

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

interface FamilyClientProps {
  initialData?: FinanceData;
}

export default function FamilyClient({
  initialData,
}: FamilyClientProps) {
  const { data: { profile, recipients, accounts, ledgerLogs }, mutate, isLoading } = useFinanceData(initialData);
  const getAccountCurrency = (accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find(a => a.id === accountId);
    return acc ? acc.currency : "INR";
  };
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [isSendingMoney, setIsSendingMoney] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Tables<"recipients"> | null>(null);
  const [submitting, withLock] = useSubmitLock();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"contacts" | "history">("contacts");
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Tables<"recipients"> | null>(null);
  
  // Member specific history
  const [selectedHistoryRecipient, setSelectedHistoryRecipient] = useState<string | null>(null);

  // Form states
  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] = useState("Family");

  const [sendAmount, setSendAmount] = useState("");
  const [sendAccountId, setSendAccountId] = useState("");
  const [sendNote, setSendNote] = useState("");

  useEffect(() => {
    if (accounts.length > 0 && !sendAccountId) {
      const defaultAccId = profile?.default_accounts?.family;
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
    setNewRelationship("Family");
    setIsSendingMoney(false);
    setSelectedRecipient(null);
    setSendAmount("");
    setSendNote("");
    setShowDeleteConfirm(false);
    setDeletingId(null);
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModals();
      }
    };
    if (isAddingRecipient || isSendingMoney || showDeleteConfirm) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAddingRecipient, isSendingMoney, showDeleteConfirm]);

  const startEdit = (person: Tables<"recipients">) => {
    setEditingRecipient(person);
    setNewName(person.name);
    setNewRelationship(person.relationship || "Family");
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
        const toastSymbol = getAccountCurrency(sendAccountId) === 'USD' ? '$' : '₹';
        toast.success(`${toastSymbol}${amount.toLocaleString()} sent to ${selectedRecipient.name}`);
        mutate();
      } else {
        toast.error(res.error || "Failed to send money");
      }
    });
  };

  // Analytics
  const getRecipientId = useCallback((log: Tables<"ledger_logs">) => {
    const metadata = log.metadata as Record<string, unknown> | null;
    if (metadata && typeof metadata === "object" && metadata.recipient_id) {
      return metadata.recipient_id as string;
    }
    if (log.details) {
      const match = recipients.find(r => log.details!.startsWith(`Sent money to ${r.name}`));
      if (match) return match.id;
    }
    return null;
  }, [recipients]);

  const recipientTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    recipients.forEach(r => totals[r.id] = 0);
    ledgerLogs.forEach(log => {
      if (log.action_type === "SEND_MONEY") {
        const recId = getRecipientId(log);
        if (recId && totals[recId] !== undefined) {
          totals[recId] += Number(log.amount || 0);
        }
      }
    });
    return totals;
  }, [ledgerLogs, recipients, getRecipientId]);

  const recentSends = ledgerLogs
    .filter((log) => {
      if (log.action_type !== "SEND_MONEY") return false;
      const recId = getRecipientId(log);
      return (!selectedHistoryRecipient || recId === selectedHistoryRecipient);
    })
    .slice(0, 20);

  const totalSent = recentSends.reduce((sum, s) => {
    return sum + Number(s.amount || 0);
  }, 0);

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
            className="btn-primary !h-11 !px-5 text-xs font-black uppercase tracking-widest flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Contact
          </button>
        </div>
      </div>

      {/* STATS STRIP */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#111111] border border-white/10 p-5 rounded-md flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[--text-muted] font-semibold">Total Contacts</span>
            <span className="text-3xl font-black text-white mt-1">{recipients.length}</span>
          </div>
          <div className="bg-[#111111] border border-white/10 p-5 rounded-md flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wider text-[--text-muted] font-semibold">Recent Volume (INR)</span>
            <span className="text-3xl font-black text-white mt-1">₹{totalSent.toLocaleString()}</span>
          </div>
        </div>

        {/* PIE CHART FOR DISTRIBUTION */}
        <div className="bg-[#111111] border border-white/10 p-5 rounded-md flex flex-col min-h-[220px]">
          <span className="text-xs uppercase tracking-wider text-[--text-muted] font-semibold mb-2">Distribution</span>
          {Object.keys(recipientTotals).length > 0 && Object.values(recipientTotals).some(v => v > 0) ? (
            <div className="flex flex-col sm:flex-row items-center gap-6 h-full mt-2 min-w-0">
              <div className="h-[140px] w-[140px] sm:h-[160px] sm:w-[160px] shrink-0 min-w-0 min-h-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                      formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Total Spent']}
                    />
                    <Pie
                      data={Object.entries(recipientTotals)
                        .filter(([_, value]) => value > 0)
                        .map(([id, value], i) => ({
                        name: recipients.find(r => r.id === id)?.name || "Unknown",
                        value,
                        color: getChartColour(i)
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {Object.entries(recipientTotals)
                        .filter(([_, value]) => value > 0)
                        .map((_, index) => (
                        <Cell key={`cell-${index}`} fill={getChartColour(index)} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 grid grid-cols-1 gap-2 overflow-y-auto max-h-[140px] w-full pr-2 custom-scrollbar">
                {Object.entries(recipientTotals)
                  .filter(([_, value]) => value > 0)
                  .map(([id, value], i) => {
                    const recipientName = recipients.find(r => r.id === id)?.name || "Unknown";
                    return (
                      <div key={id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getChartColour(i) }} />
                          <span className="text-xs text-[--text-secondary] truncate">{recipientName}</span>
                        </div>
                        <span className="text-xs font-bold text-white shrink-0">₹{value.toLocaleString()}</span>
                      </div>
                    );
                })}
              </div>
            </div>
          ) : (
             <div className="flex-1 flex items-center justify-center text-[10px] uppercase font-bold text-[--text-muted] tracking-widest text-center">
               No data to display
             </div>
          )}
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
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="glass-card rich-border min-h-[260px] p-6 animate-pulse" />
                ))
              ) : recipients.length === 0 ? (
                <div className="col-span-full py-12 text-center glass-card-static">
                  <p className="text-[--text-primary] font-medium">No contacts found</p>
                  <p className="text-xs text-[--text-muted] mt-1">Add a new contact to get started.</p>
                </div>
              ) : (
                recipients.map((person) => (
                  <div key={person.id} className="glass-card rich-border flex flex-col min-h-[260px] p-6 relative overflow-hidden transition-transform hover:-translate-y-1">
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
                       <button type="button" onClick={() => startEdit(person)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-[--accent-primary-light] hover:border-[--accent-primary]/30 transition-all">
                         <Edit2 className="w-4 h-4" />
                       </button>
                    </div>
                    
                    <div className="mt-auto">
                      <h3 className="text-lg font-bold truncate">{person.name}</h3>
                      <p className="text-2xl font-black mt-1 text-[--accent-primary]">₹{(recipientTotals[person.id] || 0).toLocaleString()}</p>
                      
                      <div className="flex items-center gap-2 mt-6">
                        <button 
                          type="button" 
                          onClick={() => { setSelectedRecipient(person); setIsSendingMoney(true); }} 
                          className="flex-1 h-11 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-[--accent-primary] to-indigo-500 text-white shadow-md shadow-[--accent-primary]/20 hover:shadow-lg hover:shadow-[--accent-primary]/30 hover:-translate-y-0.5 px-2"
                        >
                          <Send className="w-4 h-4 shrink-0" /> <span className="truncate">Send Funds</span>
                        </button>
                        
                        <button 
                          type="button" 
                          onClick={() => { setSelectedHistoryRecipient(person.id); setActiveView("history"); }} 
                          className="w-11 h-11 shrink-0 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-white hover:bg-white/10 transition-all flex items-center justify-center hover:-translate-y-0.5"
                          title="History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        
                        <button 
                          type="button" 
                          onClick={() => handleDeleteRecipient(person.id)} 
                          className="w-11 h-11 shrink-0 rounded-xl bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 hover:text-white transition-all flex items-center justify-center hover:-translate-y-0.5"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
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
                          <div className="flex flex-col">
                            <span>{send.details || "Transfer"}</span>
                            <span className="text-xs text-[--text-muted]">To: {recipients.find(r => r.id === getRecipientId(send))?.name || "Unknown"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-semibold text-danger">-{getAccountCurrency(send.account_id)}{(send.amount || 0).toLocaleString()}</span>
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

        {/* MODALS & DRAWERS */}
        {/* DELETE MODAL (Kept as centered modal for destructive actions) */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 animate-fade-in">
            <div role="dialog" aria-modal="true" className="bg-[#111111] border border-white/10 rounded-md w-full max-w-sm p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Delete Contact</h3>
              <p className="text-sm text-[--text-secondary] mb-6">
                Are you sure you want to remove <span className="text-white font-medium">{recipients.find(r => r.id === deletingId)?.name}</span>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={closeModals} className="btn-secondary !h-11 !px-5 text-xs font-black uppercase tracking-widest">Cancel</button>
                <button onClick={confirmDelete} disabled={submitting} className="btn-danger !h-11 !px-5 text-xs font-black uppercase tracking-widest flex items-center justify-center disabled:opacity-50">
                  {submitting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD/EDIT DRAWER */}
        <Drawer
          isOpen={isAddingRecipient && !showDeleteConfirm}
          onClose={closeModals}
          title={isEditingRecipient ? "Edit Contact" : "Add New Contact"}
        >
          <form onSubmit={handleAddRecipient} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Full Name</label>
              <input autoFocus required type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="input-premium" placeholder="Enter contact name" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Relationship</label>
              <input required type="text" value={newRelationship} onChange={(e) => setNewRelationship(e.target.value)} className="input-premium" placeholder="e.g. Brother, Friend" />
            </div>
            <div className="pt-4 mt-8">
              <button type="submit" disabled={submitting || !newName.trim()} className="btn-primary w-full h-12 shadow-xl shadow-[--accent-primary]/20">
                {submitting ? "Saving..." : "Save Details"}
              </button>
            </div>
          </form>
        </Drawer>

        {/* SEND MONEY DRAWER */}
        <Drawer
          isOpen={isSendingMoney && !showDeleteConfirm && !!selectedRecipient}
          onClose={closeModals}
          title="Transfer Funds"
        >
          {selectedRecipient && (
            <form onSubmit={handleSendMoney} className="space-y-6">
              <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[--accent-primary]/20 text-[--accent-primary] flex items-center justify-center font-bold text-lg">
                  {selectedRecipient.name.charAt(0)}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Recipient</p>
                  <p className="text-base font-bold text-white mt-1">{selectedRecipient.name}</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Source Account</label>
                <select required value={sendAccountId} onChange={(e) => setSendAccountId(e.target.value)} className="input-premium">
                  {accounts.map((acc) => (<option key={acc.id} value={acc.id}>{acc.name} ({acc.currency} {acc.balance.toLocaleString()})</option>))}
                </select>
                {sendAccountId && accounts.find(a => a.id === sendAccountId) && (
                  <div className="mt-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-[--text-secondary] animate-fade-in">
                    <span className="font-medium">Available Balance</span>
                    <span className="font-bold text-white">
                      {accounts.find(a => a.id === sendAccountId)?.currency === 'USD' ? '$' : '₹'}{accounts.find(a => a.id === sendAccountId)?.balance.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Transfer Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white font-bold text-lg">
                    {accounts.find(a => a.id === sendAccountId)?.currency === 'USD' ? '$' : '₹'}
                  </span>
                  <input required type="number" step="0.01" min="1" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} className="input-premium !pl-9 text-lg font-black" placeholder="0.00" />
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button key={amt} type="button" onClick={() => setSendAmount(amt.toString())} className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors border ${sendAmount === amt.toString() ? 'bg-[--accent-primary] text-white border-[--accent-primary]' : 'bg-white/5 border-white/10 text-[--text-muted] hover:text-white hover:border-white/20'}`}>
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Note (Optional)</label>
                <input value={sendNote} onChange={(e) => setSendNote(e.target.value)} className="input-premium" placeholder="e.g. Birthday gift" />
              </div>

              <div className="pt-4 mt-8">
                <button type="submit" disabled={submitting || !sendAmount} className="btn-primary w-full h-12 shadow-xl shadow-[--accent-primary]/20 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  {submitting ? "Processing..." : <><ArrowUpRight className="w-4 h-4" /> Execute Transfer</>}
                </button>
              </div>
            </form>
          )}
        </Drawer>
    </div>
  );
}
