"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "react-hot-toast";
import { createClient } from "@/lib/supabase-browser";
import type { Tables } from "@/lib/database.types";
import { searchBanks, type Bank } from "@/lib/banks";
import { createAccount, updateAccount, deleteAccount, createTransfer, adjustBalance } from "./actions";
import BankLogo from "@/components/bank-logo";

import { useRealTimeSync } from "@/hooks/use-realtime-sync";

// Dynamic imports for chart performance
const PieChart = dynamic(() => import("recharts").then(mod => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then(mod => mod.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then(mod => mod.Cell), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then(mod => mod.ResponsiveContainer), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then(mod => mod.Tooltip), { ssr: false });

type Account = Tables<"accounts">;

const supabase = createClient();

const CategoryIcon = ({ type, className = "w-6 h-6" }: { type: string; className?: string }) => {
  const styles: Record<string, { bg: string; color: string; path: string }> = {
    checking: { bg: "rgba(108, 92, 231, 0.1)", color: "var(--accent-primary-light)", path: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
    savings: { bg: "rgba(0, 184, 148, 0.1)", color: "var(--success)", path: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    credit: { bg: "rgba(214, 48, 49, 0.1)", color: "var(--danger)", path: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
    investment: { bg: "rgba(9, 132, 227, 0.1)", color: "#74b9ff", path: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" },
    cash: { bg: "rgba(253, 203, 110, 0.1)", color: "var(--warning)", path: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  };
  const style = styles[type] || styles.checking;
  return (
    <div className={`p-2.5 rounded-xl border border-white/5 shadow-inner ${style.bg} ${className} flex items-center justify-center`}>
      <svg className="w-full h-full" style={{ color: style.color }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={style.path} /></svg>
    </div>
  );
};

const TYPE_STYLES: Record<string, { gradient: string; badge: string; badgeBorder: string; color: string; iconBg: string }> = {
  checking: { gradient: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-primary-light) 100%)", badge: "rgba(162,155,254,0.1)", badgeBorder: "rgba(162,155,254,0.2)", color: "var(--accent-primary-light)", iconBg: "rgba(162,155,254,0.1)" },
  savings: { gradient: "linear-gradient(135deg, var(--success) 0%, #55efc4 100%)", badge: "rgba(0, 184, 148, 0.1)", badgeBorder: "rgba(0, 184, 148, 0.2)", color: "var(--success)", iconBg: "rgba(0, 184, 148, 0.1)" },
  credit: { gradient: "linear-gradient(135deg, #fd79a8 0%, var(--warning) 100%)", badge: "rgba(214, 48, 49, 0.1)", badgeBorder: "rgba(214, 48, 49, 0.2)", color: "var(--danger)", iconBg: "rgba(214, 48, 49, 0.1)" },
  investment: { gradient: "linear-gradient(135deg, #0984e3 0%, var(--accent-secondary) 100%)", badge: "rgba(116, 185, 255, 0.1)", badgeBorder: "rgba(116, 185, 255, 0.2)", color: "#74b9ff", iconBg: "rgba(116, 185, 255, 0.1)" },
  cash: { gradient: "linear-gradient(135deg, var(--warning) 0%, #ffeaa7 100%)", badge: "rgba(253, 203, 110, 0.1)", badgeBorder: "rgba(253, 203, 110, 0.2)", color: "var(--warning)", iconBg: "rgba(253, 203, 110, 0.1)" },
};

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = { INR: "₹", USD: "$" };
  return symbols[currency] || currency;
}

interface AccountsClientProps {
  initialAccounts: Account[];
}

export default function AccountsClient({ initialAccounts }: AccountsClientProps) {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(searchParams.get("action") === "new");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [bankSearch, setBankSearch] = useState("");
  const [bankResults, setBankResults] = useState<Bank[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromId, setTransferFromId] = useState<string | null>(null);
  const [transferData, setTransferData] = useState({ to_account_id: "", amount: "", note: "" });
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingAccountId, setAdjustingAccountId] = useState<string | null>(null);
  const [adjustData, setAdjustData] = useState({ amount: "", note: "", type: "add" as "add" | "subtract" });
  const [formData, setFormData] = useState({ name: "", type: "checking", balance: "0", currency: "INR", bank_name: "" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("accounts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) setAccounts(data);
  }, []);

  useEffect(() => {
    const channel = supabase.channel("accounts-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => startTransition(loadAccounts))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAccounts]);

  useRealTimeSync(loadAccounts);

  function handleBankSearch(query: string) {
    setBankSearch(query);
    const results = searchBanks(query);
    setBankResults(results);
  }

  function selectBank(bank: Bank) {
    setFormData({ ...formData, bank_name: bank.name });
    setBankSearch(bank.name);
    setBankResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const data = { name: formData.name, type: formData.type, balance: parseFloat(formData.balance), currency: formData.currency, bank_name: formData.bank_name || null };
    const result = editingId ? await updateAccount(editingId, data) : await createAccount(data);
    if (!result?.error) {
      toast.success(editingId ? "Account updated" : "Account created");
      resetForm();
      loadAccounts();
    } else {
      toast.error(result.error);
    }
    setSubmitting(false);
  }

  function resetForm() {
    setFormData({ name: "", type: "checking", balance: "0", currency: "INR", bank_name: "" });
    setShowForm(false);
    setEditingId(null);
    setSubmitting(false);
  }

  function startEdit(account: Account) {
    setFormData({ name: account.name, type: account.type, balance: account.balance.toString(), currency: account.currency, bank_name: account.bank_name || "" });
    setEditingId(account.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    const account = accounts.find(a => a.id === id);
    if (account?.name === "Cash") { toast.error("Cannot delete Cash"); return; }
    setDeletingAccountId(id);
    setShowDeleteConfirm(true);
  }

  async function confirmDelete() {
    if (!deletingAccountId) return;
    const res = await deleteAccount(deletingAccountId);
    if (!res?.error) { toast.success("Deleted"); loadAccounts(); } else toast.error(res.error);
    setShowDeleteConfirm(false);
    setDeletingAccountId(null);
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustingAccountId) return;
    const amount = parseFloat(adjustData.amount);
    const finalAmount = adjustData.type === "subtract" ? -amount : amount;
    const res = await adjustBalance(adjustingAccountId, finalAmount, adjustData.note);
    if (!res?.error) { toast.success("Balance updated"); setShowAdjustModal(false); loadAccounts(); } else toast.error(res.error);
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferFromId) return;
    const res = await createTransfer({ from_account_id: transferFromId, to_account_id: transferData.to_account_id, amount: parseFloat(transferData.amount), note: transferData.note || null });
    if (!res?.error) { toast.success("Transfer complete"); setShowTransferModal(false); loadAccounts(); } else toast.error(res.error);
  }

  const balancesByCurrency = accounts.reduce((acc, a) => { acc[a.currency] = (acc[a.currency] || 0) + a.balance; return acc; }, {} as Record<string, number>);
  const accountColors = ["#a29bfe", "#55efc4", "#fd79a8", "#74b9ff", "#fdcb6e", "#00cec9", "#6c5ce7", "#ff6b81"];
  const chartData = accounts.map((a, i) => ({ name: a.name, value: a.balance, color: accountColors[i % accountColors.length], currency: a.currency }));

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Accounts Portfolio</h1>
          <p className="text-[13px] md:text-sm mt-1 font-medium text-[--text-muted]">Manage your financial footprint</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <button onClick={() => { setTransferFromId(null); setShowTransferModal(true); }} className="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>Transfer</button>
          <button onClick={() => setShowForm(true)} className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>New Account</button>
        </div>
      </div>

      <div className="glass-card-static relative overflow-hidden p-6 md:p-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-10">
          <div className="z-10 w-full text-center lg:text-left">
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-[0.3em] text-[--text-muted] mb-2">Portfolio Assets</p>
            <div className="flex flex-wrap items-baseline justify-center lg:justify-start gap-4 md:gap-6 mb-8">
              {Object.entries(balancesByCurrency).map(([curr, bal]) => (
                <h2 key={curr} className="text-3xl md:text-5xl font-black tracking-tight text-[--text-primary]">
                  {getCurrencySymbol(curr)}{bal.toLocaleString()}
                </h2>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {chartData.map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-white/[0.03] border border-white/5 h-[64px] md:h-[72px] hover:bg-white/[0.05] transition-all">
                   <div className="relative flex-shrink-0">
                     {accounts[i].bank_name ? <BankLogo bankName={accounts[i].bank_name!} size={40} /> : <CategoryIcon type={accounts[i].type} className="w-10 h-10" />}
                   </div>
                   <div className="flex flex-col min-w-0 flex-1 text-left">
                     <p className="font-bold text-[11px] md:text-xs text-[--text-secondary] truncate">{item.name}</p>
                     <p className="font-black text-[13px] md:text-sm text-[--accent-primary-light]">{getCurrencySymbol(item.currency)}{item.value.toLocaleString()}</p>
                   </div>
                </div>
              ))}
            </div>
          </div>
          <div className="shrink-0 w-[240px] h-[240px] md:w-[320px] md:h-[320px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={chartData} 
                  innerRadius={70} 
                  outerRadius={95} 
                  paddingAngle={4} 
                  dataKey="value" 
                  stroke="none"
                  animationDuration={1000}
                >
                  {chartData.map((e, i) => (<Cell key={i} fill={e.color} />))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <p className="text-[9px] uppercase font-black text-[--text-muted] mb-1 tracking-widest">Net Value</p>
              <div className="flex flex-col gap-0.5">
                {Object.entries(balancesByCurrency).map(([c,b]) => (
                  <p key={c} className="text-base md:text-lg font-black text-[--text-primary] leading-tight">
                    {getCurrencySymbol(c)}{b.toLocaleString()}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((a) => {
          const style = TYPE_STYLES[a.type] || TYPE_STYLES.checking;
          return (
            <div key={a.id} className="glass-card flex flex-col min-h-[260px] p-6 relative overflow-hidden transition-transform hover:-translate-y-1">
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: style.gradient }} />
              <div className="flex justify-between items-start mb-6">
                 <div><span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider" style={{ background: style.badge, color: style.color, border: `1px solid ${style.badgeBorder}` }}>{a.type}</span><div className="flex items-center gap-3 mt-4">{a.bank_name ? <BankLogo bankName={a.bank_name} size={48} /> : <CategoryIcon type={a.type} className="w-12 h-12" />}<span className="text-base font-bold text-[--text-secondary]">{a.bank_name || a.name}</span></div></div>
                 {a.name !== "Cash" && <button onClick={() => startEdit(a)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] hover:text-white transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>}
              </div>
              <div className="mt-auto">
                <h3 className="text-lg font-bold truncate">{a.name}</h3>
                <p className="text-2xl font-black mt-1" style={{ color: style.color }}>{getCurrencySymbol(a.currency)} {a.balance.toLocaleString()}</p>
                <div className="flex gap-2 mt-6">
                  <button onClick={() => { setAdjustingAccountId(a.id); setShowAdjustModal(true); }} className="flex-1 h-12 rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2" style={{ background: style.iconBg, color: style.color, border: `1px solid ${style.badgeBorder}` }}><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>Adjust balance</button>
                  {a.name !== "Cash" && <button onClick={() => handleDelete(a.id)} className="w-12 h-12 rounded-xl bg-[--danger]/10 border border-[--danger]/20 text-[--danger] hover:bg-[--danger]/20 transition-all flex items-center justify-center"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-xl animate-fade-in">
           <div className="glass-card-static w-full max-w-xl p-8 animate-scale-in max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-8"><div><h2 className="text-2xl font-black">{editingId ? "Update Account" : "Open New Account"}</h2><p className="text-xs text-[--text-muted] mt-1 uppercase tracking-widest font-bold">Financial Entity Register</p></div><button onClick={resetForm} className="p-2 rounded-xl bg-white/5 text-[--text-muted]"><svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button></div>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div><label className="block text-[10px] font-black uppercase tracking-widest text-[--text-muted] mb-2 ml-1">Account Label</label><input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-premium" placeholder="e.g. Primary Savings" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-black uppercase tracking-widest text-[--text-muted] mb-2 ml-1">Asset Category</label><select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="input-premium">{Object.keys(TYPE_STYLES).map(t => <option key={t} value={t} style={{background: "var(--bg-surface)"}}>{t.toUpperCase()}</option>)}</select></div>
                  <div><label className="block text-[10px] font-black uppercase tracking-widest text-[--text-muted] mb-2 ml-1">Currency</label><select value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="input-premium"><option value="INR" style={{background: "var(--bg-surface)"}}>INR (₹)</option><option value="USD" style={{background: "var(--bg-surface)"}}>USD ($)</option></select></div>
                </div>
                {!editingId && <div><label className="block text-[10px] font-black uppercase tracking-widest text-[--text-muted] mb-2 ml-1">Opening Balance</label><input type="number" value={formData.balance} onChange={e => setFormData({...formData, balance: e.target.value})} className="input-premium" placeholder="0.00" /></div>}
                <div className="relative">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[--text-muted] mb-2 ml-1">Bank Institution</label>
                  <input value={bankSearch} onChange={e => handleBankSearch(e.target.value)} className="input-premium" placeholder="Search Banks..." />
                  {bankResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-2 bg-[--bg-surface] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">{bankResults.slice(0, 5).map(b => <button key={b.name} type="button" onClick={() => selectBank(b)} className="w-full p-4 flex items-center gap-3 hover:bg-white/5 text-left border-b border-white/5 last:border-0"><BankLogo bankName={b.name} size={32} /><div><p className="font-bold text-sm">{b.name}</p><p className="text-[10px] text-[--text-muted]">{b.domain}</p></div></button>)}</div>}
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full shadow-xl shadow-[--accent-primary]/20 transition-all mt-4">{submitting ? "Processing Registry..." : (editingId ? "Update Portfolio" : "Activate Account")}</button>
              </form>
           </div>
        </div>
      )}

      {showAdjustModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in"><div className="glass-card-static w-full max-w-sm p-8 animate-scale-in">
          <div className="flex justify-between items-center mb-6"><div><h3 className="text-xl font-black">Adjust Balance</h3><p className="text-[10px] font-bold text-[--text-muted] uppercase tracking-widest">Balance Modification</p></div><button onClick={() => setShowAdjustModal(false)} className="text-[--text-muted]"><svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button></div>
          <form onSubmit={handleAdjust} className="space-y-6">
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setAdjustData({...adjustData, type: 'add'})} className={`py-4 rounded-xl font-bold transition-all border ${adjustData.type === 'add' ? 'bg-[--success]/20 border-[--success] text-[--success]' : 'bg-white/5 border-white/10 text-[--text-muted]'}`}>INCREMENT</button><button type="button" onClick={() => setAdjustData({...adjustData, type: 'subtract'})} className={`py-4 rounded-xl font-bold transition-all border ${adjustData.type === 'subtract' ? 'bg-[--danger]/20 border-[--danger] text-[--danger]' : 'bg-white/5 border-white/10 text-[--text-muted]'}`}>DECREMENT</button></div>
            <div><label className="block text-[10px] font-black text-[--text-muted] mb-2 uppercase tracking-widest">Amount</label><input required type="number" step="0.01" value={adjustData.amount} onChange={e => setAdjustData({...adjustData, amount: e.target.value})} className="input-premium !h-14 text-xl font-black" placeholder="0.00" /></div>
            <div><label className="block text-[10px] font-black text-[--text-muted] mb-2 uppercase tracking-widest">Reason / Note</label><input value={adjustData.note} onChange={e => setAdjustData({...adjustData, note: e.target.value})} className="input-premium" placeholder="Why the change?" /></div>
            <button type="submit" className="btn-primary w-full h-14 font-black mt-2">Finalize Adjustment</button>
          </form>
        </div></div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in">
           <div className="glass-card-static w-full max-w-md p-8 animate-scale-in">
              <div className="flex justify-between items-center mb-8"><div><h3 className="text-xl font-black">Inter-Account Transfer</h3><p className="text-[10px] font-bold text-[--text-muted] uppercase tracking-widest">Financial reallocation</p></div><button onClick={() => setShowTransferModal(false)} className="text-[--text-muted]"><svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg></button></div>
              <form onSubmit={handleTransfer} className="space-y-6">
                <div><label className="block text-[10px] font-black text-[--text-muted] mb-2 ml-1">SOURCE ACCOUNT</label><select required value={transferFromId || ""} onChange={e => setTransferFromId(e.target.value)} className="input-premium h-14"><option value="">Select source</option>{accounts.map(a => <option key={a.id} value={a.id} style={{background: "var(--bg-surface)"}}>{a.name} ({getCurrencySymbol(a.currency)}{a.balance.toLocaleString()})</option>)}</select></div>
                <div><label className="block text-[10px] font-black text-[--text-muted] mb-2 ml-1">DESTINATION ACCOUNT</label><select required value={transferData.to_account_id} onChange={e => setTransferData({...transferData, to_account_id: e.target.value})} className="input-premium h-14"><option value="">Select target</option>{accounts.map(a => a.id !== transferFromId && <option key={a.id} value={a.id} style={{background: "var(--bg-surface)"}}>{a.name} ({getCurrencySymbol(a.currency)}{a.balance.toLocaleString()})</option>)}</select></div>
                <div><label className="block text-[10px] font-black text-[--text-muted] mb-2 ml-1">AMOUNT</label><input required type="number" step="0.01" value={transferData.amount} onChange={e => setTransferData({...transferData, amount: e.target.value})} className="input-premium !h-14 text-xl font-black" placeholder="0.00" /></div>
                <button type="submit" className="btn-primary w-full shadow-xl shadow-[--accent-primary]/20 mt-4">Execute Transfer</button>
              </form>
           </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[--bg-base]/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card-static w-full max-w-sm p-8 animate-scale-in">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center">
                <svg className="w-7 h-7 text-rose-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-black text-[--text-primary]">Delete Account</h3>
                <p className="text-sm text-[--text-secondary] mt-2">Are you sure you want to delete <span className="font-bold text-rose-400">{accounts.find(a => a.id === deletingAccountId)?.name}</span>? This action cannot be undone.</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={() => { setShowDeleteConfirm(false); setDeletingAccountId(null); }} className="btn-secondary flex-1 h-12 font-bold rounded-xl">Cancel</button>
                <button onClick={confirmDelete} className="btn-danger flex-1 h-12 font-bold rounded-xl">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
