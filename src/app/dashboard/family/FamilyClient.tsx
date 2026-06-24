"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createRecipient, deleteRecipient, sendMoneyToFamily, updateRecipient } from "./actions";
import { toast } from "react-hot-toast";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { Plus } from "lucide-react";
import type { Tables } from "@/lib/database.types";
import { Drawer } from "@/components/ui/drawer";
import dynamic from "next/dynamic";
import { getChartColour } from "@/lib/chart-colours";

import { PieChart, Pie, Cell, Tooltip } from "recharts";

import ContactCard from "./components/ContactCard";
import TransferHistoryTable from "./components/TransferHistoryTable";
import ContactForm from "./components/ContactForm";
import TransferForm from "./components/TransferForm";

const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

interface FamilyClientProps {
  initialData?: FinanceData;
}

export default function FamilyClient({ initialData }: FamilyClientProps) {
  const { data: { profile, recipients, accounts, ledgerLogs }, mutate, isLoading } = useFinanceData(initialData);

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
  const [activeView, setActiveView] = useState<"contacts" | "history">("contacts");
  
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState<Tables<"recipients"> | null>(null);

  const [selectedHistoryRecipient, setSelectedHistoryRecipient] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newRelationship, setNewRelationship] = useState("Family");

  const [sendAmount, setSendAmount] = useState("");
  const [sendAccountId, setSendAccountId] = useState("");
  const [sendNote, setSendNote] = useState("");

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
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModals();
    };
    if (isAddingRecipient || isSendingMoney || showDeleteConfirm) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddingRecipient, isSendingMoney, showDeleteConfirm]);

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

  const recipientTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    recipients.forEach((r) => (totals[r.id] = 0));
    ledgerLogs.forEach((log) => {
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
      return !selectedHistoryRecipient || recId === selectedHistoryRecipient;
    })
    .slice(0, 20);

  const totalSent = recentSends.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">
              Family & Transfers
            </h1>
            <div className={`status-dot scale-90 ${isLoading ? "animate-pulse bg-yellow-400" : "bg-emerald-400 opacity-50"}`} />
          </div>
          <p className="text-[--text-secondary] text-[13px] md:text-sm mt-1">
            Manage family members and execute secure transfers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setIsAddingRecipient(true)}
            className="btn-primary flex-1 md:flex-none gap-2"
          >
            <Plus className="w-4 h-4" />
            New Contact
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between group">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Total Contacts</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate text-[--text-primary]">
              {recipients.length}
            </h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">Directory</span>
          </div>
        </div>
        <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Recent Volume (INR)</p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h3 className="text-xl md:text-2xl font-black truncate text-white">
              ₹{totalSent.toLocaleString()}
            </h3>
            <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-[--accent-primary]/10 text-[--accent-primary] border border-[--accent-primary]/20 font-bold">Transfers</span>
          </div>
        </div>
        <div className="md:col-span-2 glass-card-static p-5 md:p-8 flex flex-col justify-between bg-gradient-to-br from-indigo-500/5 to-transparent">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted] mb-2">Distribution</p>
          {Object.keys(recipientTotals).length > 0 && Object.values(recipientTotals).some((v) => v > 0) ? (
            <div className="flex flex-col sm:flex-row items-center gap-6 h-full mt-2">
              <div className="h-[120px] w-[120px] sm:h-[140px] sm:w-[140px] shrink-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                      itemStyle={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}
                      formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Total Spent"]}
                    />
                    <Pie
                      data={Object.entries(recipientTotals)
                        .filter(([_, value]) => value > 0)
                        .map(([id, value], i) => ({
                          name: recipients.find((r) => r.id === id)?.name || "Unknown",
                          value: Number(value),
                          fill: getChartColour(i),
                        }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 grid grid-cols-1 gap-2 overflow-y-auto max-h-[140px] w-full pr-2 custom-scrollbar">
                {Object.entries(recipientTotals)
                  .filter(([_, value]) => value > 0)
                  .map(([id, value], i) => {
                    const recipientName = recipients.find((r) => r.id === id)?.name || "Unknown";
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

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-6 border-b border-white/10 overflow-x-auto no-scrollbar">
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
          <button
            onClick={() => {
              setActiveView("history");
              setSelectedHistoryRecipient(null);
            }}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeView === "history"
                ? "border-[--accent-primary] text-[--accent-primary]"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Transaction History
          </button>
        </div>

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
                  <ContactCard
                    key={person.id}
                    person={person}
                    totalSent={recipientTotals[person.id] || 0}
                    onEdit={startEdit}
                    onSend={(p) => {
                      setSelectedRecipient(p);
                      setIsSendingMoney(true);
                    }}
                    onHistory={(id) => {
                      setSelectedHistoryRecipient(id);
                      setActiveView("history");
                    }}
                    onDelete={handleDeleteRecipient}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {activeView === "history" && (
          <TransferHistoryTable
            recentSends={recentSends}
            recipients={recipients}
            getRecipientId={getRecipientId}
            getAccountCurrency={getAccountCurrency}
            selectedHistoryRecipient={selectedHistoryRecipient}
            onClearFilter={() => setSelectedHistoryRecipient(null)}
          />
        )}
      </div>

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

      {isSendingMoney && !showDeleteConfirm && selectedRecipient && (
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
