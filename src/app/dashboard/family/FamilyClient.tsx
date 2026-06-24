"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createRecipient, deleteRecipient, sendMoneyToFamily, updateRecipient } from "./actions";
import { revertLedgerTransaction } from "@/app/dashboard/ledger/actions";
import { toast } from "react-hot-toast";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { Plus } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import { Drawer } from "@/components/ui/drawer";
import dynamic from "next/dynamic";
import { format, parseISO, subMonths } from "date-fns";
import { getChartColour } from "@/lib/chart-colours";
import { exportToCSV } from "@/lib/export-csv";

import { PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";

import ContactCard from "./components/ContactCard";
import FamilyDataTable from "./components/FamilyDataTable";
import ContactForm from "./components/ContactForm";
import TransferForm from "./components/TransferForm";

const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

interface FamilyClientProps {
  initialData?: FinanceData;
}

export default function FamilyClient({ initialData }: FamilyClientProps) {
  const { data: { profile, recipients, accounts, ledgerLogs }, mutate, isValidating } = useFinanceData(initialData);

  const searchParams = useSearchParams();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  const getAccountCurrency = useCallback((accountId: string | null) => {
    if (!accountId) return "INR";
    const acc = accounts.find((a) => a.id === accountId);
    return acc ? acc.currency : "INR";
  }, [accounts]);

  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [isSendingMoney, setIsSendingMoney] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Tables<"recipients"> | null>(null);
  const [submitting, withLock] = useSubmitLock();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [isRevertingTransfer, setIsRevertingTransfer] = useState(false);
  const [revertingLogId, setRevertingLogId] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<"overview" | "contacts">("overview");
  
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Tables<"recipients"> | null>(null);

  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] = useState("Family");

  const [sendAmount, setSendAmount] = useState("");
  const [sendAccountId, setSendAccountId] = useState("");
  const [sendNote, setSendNote] = useState("");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (accounts.length > 0 && !sendAccountId) {
      const defaultAccId = profile?.default_accounts?.family;
      const defaultAccExists = defaultAccId && accounts.some((a) => a.id === defaultAccId);
      setTimeout(() => {
        setSendAccountId(defaultAccExists ? defaultAccId : accounts[0].id);
      }, 0);
    }
  }, [accounts, sendAccountId, profile]);

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
    setIsRevertingTransfer(false);
    setRevertingLogId(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModals();
    };
    if (isAddingRecipient || isSendingMoney || showDeleteConfirm || isRevertingTransfer) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddingRecipient, isSendingMoney, showDeleteConfirm, isRevertingTransfer]);

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    await withLock(async () => {
      let res;
      if (isEditingRecipient && editingRecipient) {
        res = await updateRecipient(editingRecipient.id, { name: newName, relationship: newRelationship });
        if (res.success) {
          toast.success(`${newName} updated`);
          closeModals();
          mutate();
        } else {
          toast.error(res.error || "Failed to update contact");
        }
        return;
      }

      res = await createRecipient({ name: newName, relationship: newRelationship });
      if (res.success) {
        closeModals();
        toast.success(`${newName} added to contacts`);
        mutate();
      } else {
        toast.error(res.error || "Failed to add recipient");
      }
    });
  };

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

  const handleRevertTransfer = (id: string) => {
    setRevertingLogId(id);
    setIsRevertingTransfer(true);
  };

  const confirmRevertTransfer = async () => {
    if (!revertingLogId) return;
    await withLock(async () => {
      const res = await revertLedgerTransaction(revertingLogId);
      
      if (res.error) {
        toast.error(`Revert failed: ${res.error}`);
      } else {
        toast.success("Transfer reversed successfully");
        mutate();
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

    const selectedAcc = accounts.find((a) => a.id === sendAccountId);
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
        const toastSymbol = getAccountCurrency(sendAccountId) === "USD" ? "$" : "₹";
        toast.success(`${toastSymbol}${amount.toLocaleString()} sent to ${selectedRecipient.name}`);
        mutate();
      } else {
        toast.error(res.error || "Failed to send money");
      }
    });
  };

  const getRecipientId = useCallback((log: Tables<"ledger_logs">) => {
    const metadata = log.metadata as Record<string, unknown> | null;
    if (metadata && typeof metadata === "object" && metadata.recipient_id) {
      return metadata.recipient_id as string;
    }
    if (log.details) {
      const match = recipients.find((r) => log.details!.startsWith(`Sent money to ${r.name}`));
      if (match) return match.id;
    }
    return null;
  }, [recipients]);

  const stats = useMemo(() => {
    const targetDate = new Date(selectedYear, selectedMonth - 1, 1);
    const familyLogs = ledgerLogs.filter(log => log.action_type === "SEND_MONEY");
    
    const currentMonth = familyLogs.filter(e => {
      if (!e.created_at) return false;
      const d = parseISO(e.created_at);
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
    });

    const totalSent = familyLogs.reduce((s, e) => s + Number(e.amount || 0), 0);
    const monthlyTotal = currentMonth.reduce((s, e) => s + Number(e.amount || 0), 0);
    
    const recipientTotals: Record<string, number> = {};
    currentMonth.forEach(e => {
      const recId = getRecipientId(e);
      if (recId) {
        recipientTotals[recId] = (recipientTotals[recId] || 0) + Number(e.amount || 0);
      }
    });

    const pieData = Object.entries(recipientTotals).map(([id, value], index) => {
      const recipientName = recipients.find(r => r.id === id)?.name || "Unknown";
      const color = getChartColour(index);
      return {
        name: recipientName, 
        value,
        fill: color,
        color,
      };
    }).sort((a, b) => b.value - a.value);

    const trendMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(targetDate, i);
      trendMap[format(d, "MMM yy")] = 0;
    }
    familyLogs.forEach(e => {
      if (!e.created_at) return;
      const m = format(parseISO(e.created_at), "MMM yy");
      if (trendMap[m] !== undefined) {
        trendMap[m] += Number(e.amount || 0);
      }
    });
    const trendData = Object.entries(trendMap).map(([name, value]) => ({ name, value }));

    return { totalSent, monthlyTotal, pieData, trendData, currentMonth };
  }, [ledgerLogs, selectedMonth, selectedYear, recipients, getRecipientId]);

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      {/* Header matching Expenses */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Family & Transfers</h1>
            <div className={`status-dot scale-90 ${isValidating ? 'animate-pulse bg-yellow-400' : 'bg-emerald-400 opacity-50'}`} />
          </div>
          <p className="text-[--text-secondary] text-[13px] md:text-sm mt-1">Monitor your family transfers and manage your contact directory.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select 
            className="btn-secondary !h-11 px-4 text-xs font-bold" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(parseInt(e.target.value))}
            aria-label="Select month"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1} className="bg-[--bg-surface]">
                {format(new Date(2020, i, 1), "MMMM")}
              </option>
            ))}
          </select>
          <select 
            className="btn-secondary !h-11 px-4 text-xs font-bold" 
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            aria-label="Select year"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
              <option key={y} value={y} className="bg-[--bg-surface]">{y}</option>
            ))}
          </select>
          <button type="button" 
            onClick={() => {
              exportToCSV(
                stats.currentMonth.map(e => {
                  const recId = getRecipientId(e);
                  return {
                    date: e.created_at ? format(parseISO(e.created_at), "yyyy-MM-dd") : "",
                    description: e.details,
                    recipient: recipients.find(r => r.id === recId)?.name || "Unknown",
                    amount: Number(e.amount),
                    account: accounts.find(a => a.id === e.account_id)?.name || "Direct Log"
                  };
                }),
                "family_transfers",
                [
                  { key: "date", label: "Date" },
                  { key: "description", label: "Description" },
                  { key: "recipient", label: "Recipient" },
                  { key: "amount", label: "Amount" },
                  { key: "account", label: "Account" }
                ]
              );
            }}
            className="btn-secondary flex-1 md:flex-none gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-white/10 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveView("overview")}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeView === "overview"
              ? "border-[--accent-primary] text-[--accent-primary]"
              : "border-transparent text-[--text-muted] hover:text-white"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveView("contacts")}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeView === "contacts"
              ? "border-[--accent-primary] text-[--accent-primary]"
              : "border-transparent text-[--text-muted] hover:text-white"
          }`}
        >
          Directory
        </button>
      </div>

      {activeView === "overview" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Stats Grid matching Expenses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between group">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Net Sent</p>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <h3 className="text-xl md:text-2xl font-black truncate text-danger">
                  -₹{stats.totalSent.toLocaleString()}
                </h3>
                <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">All Time</span>
              </div>
            </div>
            <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Monthly Flow</p>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <h3 className="text-xl md:text-2xl font-black truncate text-danger">
                  -₹{stats.monthlyTotal.toLocaleString()}
                </h3>
                <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-[--accent-primary]/10 text-[--accent-primary] border border-[--accent-primary]/20 font-bold">{format(new Date(selectedYear, selectedMonth - 1, 1), "MMM")}</span>
              </div>
            </div>
            <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Average</p>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <h3 className="text-xl md:text-2xl font-black truncate text-danger">
                  -₹{(stats.currentMonth.length ? stats.monthlyTotal / stats.currentMonth.length : 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
                </h3>
                <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-white/5 text-[--text-muted]">{stats.currentMonth.length} txns</span>
              </div>
            </div>
            <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between bg-gradient-to-br from-indigo-500/10 to-transparent">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Top Recipient</p>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <h3 className="text-xl md:text-2xl font-black truncate">{stats.pieData[0]?.name || "None"}</h3>
                <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-white/5 text-[--text-muted]">Highest</span>
              </div>
            </div>
          </div>

          {/* Charts matching Expenses */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card-static p-5 md:p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted]">Transfer Velocity</h3>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500" /><span className="text-[10px] font-bold text-[--text-muted]">Monthly Trend</span></div>
              </div>
              <div className="h-[280px] w-full">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart data={stats.trendData}>
                      <defs>
                        <linearGradient id="colorFamily" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} dy={10} />
                      <YAxis hide />
                      <RechartsTooltip
                        contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '12px' }}
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorFamily)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="glass-card-static p-5 md:p-8">
              <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-8">Recipient Allocation</h3>
              <div className="h-[240px] w-full">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value">
                        {stats.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
                {stats.pieData.slice(0, 4).map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{background: item.color}} />
                    <span className="text-[10px] font-bold text-[--text-secondary] truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <FamilyDataTable
            recentSends={stats.currentMonth}
            accounts={accounts}
            recipients={recipients}
            getRecipientId={getRecipientId}
            onRevert={handleRevertTransfer}
            onAdd={() => setIsSendingMoney(true)}
          />
        </div>
      )}

      {activeView === "contacts" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-white">Contact Directory</h2>
            <button
              onClick={() => setIsAddingRecipient(true)}
              className="btn-primary gap-2 !h-10"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipients.length === 0 ? (
              <div className="col-span-full py-12 text-center glass-card-static">
                <p className="text-[--text-primary] font-medium">No contacts found</p>
                <p className="text-xs text-[--text-muted] mt-1">Add a new contact to get started.</p>
              </div>
            ) : (
              recipients.map((person) => {
                const totalSentToPerson = ledgerLogs
                  .filter(log => log.action_type === "SEND_MONEY" && getRecipientId(log) === person.id)
                  .reduce((sum, log) => sum + Number(log.amount || 0), 0);

                return (
                  <ContactCard
                    key={person.id}
                    person={person}
                    totalSent={totalSentToPerson}
                    onEdit={startEdit}
                    onSend={(p) => {
                      setSelectedRecipient(p);
                      setIsSendingMoney(true);
                    }}
                    onHistory={() => {
                      // Removed onHistory to switch to old table view
                    }}
                    onDelete={handleDeleteRecipient}
                  />
                );
              })
            )}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 animate-fade-in">
          <div role="dialog" aria-modal="true" className="bg-[#111111] border border-white/10 rounded-md w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Delete Contact</h3>
            <p className="text-sm text-[--text-secondary] mb-6">
              Are you sure you want to remove <span className="text-white font-medium">{recipients.find((r) => r.id === deletingId)?.name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={closeModals} className="btn-secondary !h-11 !px-5 text-xs font-black uppercase tracking-widest">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={submitting} className="btn-danger !h-11 !px-5 text-xs font-black uppercase tracking-widest flex items-center justify-center disabled:opacity-50">
                {submitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isRevertingTransfer && (
        <div role="dialog" aria-modal="true" className="mobile-dialog-shell fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in">
          <div className="mobile-dialog-panel glass-card-static w-full max-w-sm p-8 animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                <svg className="w-7 h-7 text-rose-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black text-[--text-primary]">Revert Transfer</h3>
                <p className="text-sm text-[--text-secondary] mt-2">Are you sure you want to revert this transfer? Your account balance will be refunded.</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button type="button" onClick={closeModals} className="btn-secondary flex-1 h-11 font-bold rounded-xl">Cancel</button>
                <button type="button" onClick={confirmRevertTransfer} className="btn-danger flex-1 h-11 font-bold rounded-xl" disabled={submitting}>Revert</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddingRecipient && !showDeleteConfirm && (
        <Drawer
          isOpen={isAddingRecipient}
          onClose={closeModals}
          title={isEditingRecipient ? "Edit Contact" : "Add New Contact"}
        >
          <ContactForm
            newName={newName}
            setNewName={setNewName}
            newRelationship={newRelationship}
            setNewRelationship={setNewRelationship}
            submitting={submitting}
            isEditingRecipient={isEditingRecipient}
            onSubmit={handleAddRecipient}
          />
        </Drawer>
      )}

      {isSendingMoney && !showDeleteConfirm && !isRevertingTransfer && selectedRecipient && (
        <Drawer isOpen={isSendingMoney} onClose={closeModals} title="Transfer Funds">
          <TransferForm
            selectedRecipient={selectedRecipient}
            sendAccountId={sendAccountId}
            setSendAccountId={setSendAccountId}
            sendAmount={sendAmount}
            setSendAmount={setSendAmount}
            sendNote={sendNote}
            setSendNote={setSendNote}
            accounts={accounts}
            submitting={submitting}
            onSubmit={handleSendMoney}
            QUICK_AMOUNTS={QUICK_AMOUNTS}
          />
        </Drawer>
      )}
    </div>
  );
}
