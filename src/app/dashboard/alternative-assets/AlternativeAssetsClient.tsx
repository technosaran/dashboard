"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { addAlternativeAsset, updateAlternativeAsset, deleteAlternativeAsset, revertLedgerLog } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { format, parseISO } from "date-fns";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

const CATEGORIES = [
  { label: "Real Estate", icon: "🏙️" },
  { label: "Gold / Precious Metals", icon: "🏆" },
  { label: "Physical Assets", icon: "📦" },
  { label: "Collectibles", icon: "🎨" },
  { label: "Private Equity", icon: "🤝" },
  { label: "Crypto (Cold Storage)", icon: "🔐" },
  { label: "Others", icon: "🎯" },
];

export default function AlternativeAssetsClient({ initialData }: { initialData?: FinanceData }) {
  const { data: { alternativeAssets, ledgerLogs, accounts }, mutate } = useFinanceData(initialData);
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(searchParams.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"inventory" | "history">("inventory");

  const assetLogs = useMemo(() => {
    return ledgerLogs
      .filter(log => log.details?.toLowerCase().includes("asset") || log.details?.toLowerCase().includes("physical asset"))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [ledgerLogs]);

  const [formData, setFormData] = useState({
    name: "",
    category: "Real Estate",
    purchase_price: "",
    current_value: "",
    purchase_date: "",
    notes: "",
    account_id: "",
  });

  const stats = useMemo(() => {
    const totalValue = alternativeAssets.reduce((s, a) => s + Number(a.current_value), 0);
    const totalCost = alternativeAssets.reduce((s, a) => s + Number(a.purchase_price), 0);
    const netGrowth = totalValue - totalCost;
    const growthPercent = totalCost > 0 ? (netGrowth / totalCost) * 100 : 0;
    return { totalValue, netGrowth, growthPercent };
  }, [alternativeAssets]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await withLock(async () => {
      const { account_id, ...assetData } = formData;
      const payload = {
        ...assetData,
        purchase_price: parseFloat(formData.purchase_price),
        current_value: parseFloat(formData.current_value),
        purchase_date: formData.purchase_date || undefined,
      };

      const res = editingId 
         ? await updateAlternativeAsset(editingId, payload)
         : await addAlternativeAsset({ ...payload, account_id });

      if (!res.error) {
        toast.success(editingId ? "Asset updated" : "Asset established");
        setShowAddModal(false);
        setEditingId(null);
        setFormData({ name: "", category: "Real Estate", purchase_price: "", current_value: "", purchase_date: "", notes: "", account_id: "" });
        mutate();
      } else toast.error(res.error);
    });
  }

  async function handleDeleteAsset(id: string, name: string) {
    if (!confirm(`Permanently purge this asset record: "${name}"?`)) return;
    await withLock(async () => {
      const res = await deleteAlternativeAsset(id);
      if (!res.error) {
        toast.success(`Asset "${name}" successfully purged`);
        mutate();
      } else {
        toast.error(res.error);
      }
    });
  }

  async function handleRevert(logId: string) {
    if (!confirm("Revert this action? This will undo the ledger entry and any associated balance changes.")) return;
    await withLock(async () => {
      const res = await revertLedgerLog(logId);
      if (!res.error) {
        toast.success("Action reverted successfully");
        mutate();
      } else {
        toast.error(res.error);
      }
    });
  }

  }

  return (
    <div className="flex flex-col gap-[var(--section-gap)] animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-[--text-primary]">Alternative Assets</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.4em] mt-1">Tangible Wealth & Private Holdings</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 flex-1 md:flex-none">
            <button type="button" 
              disabled={submitting}
              onClick={() => setActiveTab("inventory")}
              className={`flex-1 md:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "inventory" ? "bg-[--accent-primary] text-white shadow-lg" : "text-[--text-muted] hover:text-white"}`}
            >
              Inventory
            </button>
            <button type="button" 
              disabled={submitting}
              onClick={() => setActiveTab("history")}
              className={`flex-1 md:px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "history" ? "bg-[--accent-primary] text-white shadow-lg" : "text-[--text-muted] hover:text-white"}`}
            >
              History
            </button>
          </div>
          <button type="button" onClick={() => setShowAddModal(true)} disabled={submitting} className="btn-primary !h-11 px-6 shadow-[0_0_30px_rgba(var(--accent-primary-rgb),0.3)] text-xs font-bold uppercase tracking-wider hidden md:block">{submitting ? "Working..." : "Record New Asset"}</button>
        </div>
      </div>

      {activeTab === "inventory" ? (
        <>
          {alternativeAssets.length === 0 ? (
            <EmptyState
              title="Register Your First Asset"
              description="Track real estate, gold, collectibles, and other tangible holdings. Build a complete picture of your alternative wealth portfolio."
              icon={
                <svg className="w-8 h-8 text-[--accent-primary-light]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              }
              glowColor="indigo"
              action={
                <button type="button" onClick={() => setShowAddModal(true)} disabled={submitting} className="btn-primary shadow-xl shadow-[--accent-primary]/20 mt-8 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                  Record New Asset
                </button>
              }
            />
          ) : (
          <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 px-4">
            <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between group">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Asset Valuation</p>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <h3 className="text-xl md:text-2xl font-black truncate text-success">
                  +₹{stats.totalValue.toLocaleString()}
                </h3>
                <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-bold">Total</span>
              </div>
            </div>
            <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between group">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Portfolio Growth</p>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <h3 className={`text-xl md:text-2xl font-black truncate ${stats.netGrowth >= 0 ? "text-success" : "text-danger"}`}>
                  {stats.netGrowth >= 0 ? "+" : "-"}₹{Math.abs(stats.netGrowth).toLocaleString()}
                </h3>
                <span className={`text-[9px] w-fit px-2 py-0.5 rounded-full ${stats.netGrowth >= 0 ? "bg-success/10 text-success border border-success/20" : "bg-danger/10 text-danger border border-danger/20"} font-bold`}>Absolute</span>
              </div>
            </div>
            <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between group">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Yield (ROI)</p>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <h3 className={`text-xl md:text-2xl font-black truncate ${stats.netGrowth >= 0 ? "text-success" : "text-danger"}`}>
                  {stats.netGrowth >= 0 ? "+" : ""}{stats.growthPercent.toFixed(2)}%
                </h3>
                <span className={`text-[9px] w-fit px-2 py-0.5 rounded-full ${stats.netGrowth >= 0 ? "bg-success/10 text-success border border-success/20" : "bg-danger/10 text-danger border border-danger/20"} font-bold`}>Relative</span>
              </div>
            </div>
            <div className="glass-card-static p-5 md:p-8 flex flex-col justify-between group bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[--text-muted]">Asset Count</p>
              <div className="mt-3 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <h3 className="text-xl md:text-2xl font-black truncate text-white">
                  {alternativeAssets.length}
                </h3>
                <span className="text-[9px] w-fit px-2 py-0.5 rounded-full bg-white/5 text-[--text-muted] font-bold border border-white/10">Active</span>
              </div>
            </div>
          </div>

          {/* Assets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-4 pb-10">
            {alternativeAssets.map((asset) => {
              const category = CATEGORIES.find(c => c.label === asset.category) || CATEGORIES[6];
              const gain = Number(asset.current_value) - Number(asset.purchase_price);
              const gainPercent = (gain / Number(asset.purchase_price)) * 100;
              
              return (
                <div key={asset.id} className="glass-card-static flex flex-col min-h-[360px] p-8 relative overflow-hidden transition-all hover:translate-y-[-4px] group border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent rounded-[32px]">
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[--accent-primary] via-[--accent-secondary] to-[--accent-tertiary] opacity-30 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-2xl shadow-xl group-hover:scale-105 transition-transform">
                        {category.icon}
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-xl font-black text-white group-hover:text-[--accent-primary-light] transition-colors leading-tight">{asset.name}</h3>
                        <p className="text-[9px] font-black text-[--accent-primary-light] uppercase tracking-widest mt-1 opacity-70">{asset.category}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => {
                        setEditingId(asset.id);
                        setFormData({
                          name: asset.name,
                          category: asset.category,
                          purchase_price: asset.purchase_price.toString(),
                          current_value: asset.current_value.toString(),
                          purchase_date: asset.purchase_date || "",
                          notes: asset.notes || "", account_id: "",
                        });
                        setShowAddModal(true);
                      }} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-[--text-muted] flex items-center justify-center hover:bg-[--accent-primary] hover:text-white transition-all">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button type="button" 
                        onClick={() => handleDeleteAsset(asset.id, asset.name)} 
                        disabled={submitting}
                        className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6 mt-auto">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-[--text-muted] uppercase tracking-[0.2em]">Market Valuation</span>
                      <span className="text-3xl font-black text-white tabular-nums tracking-tighter">+₹{asset.current_value.toLocaleString()}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-widest mb-1 opacity-60">Acquisition</p>
                        <p className="text-[14px] font-black text-white tabular-nums">₹{asset.purchase_price.toLocaleString()}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-right">
                        <p className="text-[9px] font-black text-[--text-muted] uppercase tracking-widest mb-1 opacity-60">Appreciation</p>
                        <p className={`text-[14px] font-black tabular-nums ${gain >= 0 ? "text-success" : "text-danger"}`}>
                          {gain >= 0 ? "+" : ""}{gainPercent.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-5 border-t border-white/5">
                       <div className="flex items-center gap-2">
                         <div className={`w-1.5 h-1.5 rounded-full ${gain >= 0 ? "bg-success shadow-[0_0_8px_var(--success)]" : "bg-danger shadow-[0_0_8px_var(--danger)]"}`} />
                         <span className="text-[10px] font-bold text-[--text-secondary]">{asset.purchase_date ? format(parseISO(asset.purchase_date), "MMM yyyy") : "Date Unknown"}</span>
                       </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          </>
          )}
        </>
      ) : (
        <div className="glass-card-static rounded-[40px] overflow-hidden border-white/5">
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Asset Audit Trail</h3>
            <p className="text-[10px] font-black text-[--text-muted] uppercase tracking-widest">{assetLogs.length} Records Found</p>
          </div>
          <div className="table-responsive-wrapper">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[9px] text-[--text-muted] uppercase font-black tracking-widest bg-white/[0.01]">
                  <th className="py-4 px-8">Timestamp</th>
                  <th className="py-4 px-8">Action</th>
                  <th className="py-4 px-8">Details</th>
                  <th className="py-4 px-8 text-right">Amount Impact</th>
                  <th className="py-4 px-8 text-right">Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {assetLogs.map((log) => {
                  const isPositive = log.action_type === "CREATE" || log.action_type === "ADJUST_UP";
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-5 px-8">
                        <p className="text-[11px] font-bold text-white/80">{log.created_at ? format(new Date(log.created_at), "MMM d, yyyy") : "N/A"}</p>
                        <p className="text-[9px] font-bold text-[--text-muted] mt-0.5">{log.created_at ? format(new Date(log.created_at), "HH:mm:ss") : ""}</p>
                      </td>
                      <td className="py-5 px-8">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                          log.action_type === "CREATE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          log.action_type === "DELETE" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                          "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="py-5 px-8">
                        <p className="text-[12px] font-bold text-white group-hover:text-[--accent-primary-light] transition-colors">{log.details}</p>
                      </td>
                      <td className="py-5 px-8 text-right tabular-nums">
                        <p className={`text-[12px] font-black ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                          {log.amount ? `${isPositive ? "+" : "-"}₹${log.amount.toLocaleString()}` : "—"}
                        </p>
                      </td>
                      <td className="py-5 px-8 text-right">
                         <button type="button" 
                           onClick={() => handleRevert(log.id)}
                           disabled={submitting}
                           className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all bg-rose-500/5 px-3 py-1 rounded-lg border border-rose-500/10"
                         >
                           Revert
                         </button>
                      </td>
                    </tr>
                  );
                })}
                {assetLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-[11px] font-bold text-[--text-muted] uppercase tracking-[0.3em]">No historical records detected</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingId(null); }}
          title={editingId ? "Update Asset" : "Establish Asset"}
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Asset Name</label>
                <input required className="input-premium" placeholder="e.g. 2BHK Apartment - Mumbai" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoComplete="new-password" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Classification</label>
                <select aria-label="Select asset category" id="alt-asset-category" name="category" className="input-premium" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Acquisition Cost (₹)</label>
                <input required type="number" className="input-premium tabular-nums" value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Current Valuation (₹)</label>
                <input required type="number" className="input-premium tabular-nums" value={formData.current_value} onChange={e => setFormData({...formData, current_value: e.target.value})} autoComplete="new-password" inputMode="decimal" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Acquisition Date</label>
                <input type="date" className="input-premium" value={formData.purchase_date} onChange={e => setFormData({...formData, purchase_date: e.target.value})} autoComplete="new-password" />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Source Account (Optional)</label>
                <select aria-label="Select account" id="alt-asset-account" name="account_id" className="input-premium" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                  <option value="">No Transaction</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Inventory Notes / Location</label>
              <textarea className="input-premium min-h-[100px] py-4 resize-none" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} autoComplete="new-password" />
            </div>

            <div className="pt-4 mt-8">
              <button type="submit" disabled={submitting} className="btn-primary w-full h-12 shadow-xl shadow-[--accent-primary]/20 text-[11px] font-black uppercase tracking-widest">
                {submitting ? "Processing..." : editingId ? "Update Entry" : "Establish Entry"}
              </button>
            </div>
          </form>
        </Drawer>
      )}
    </div>
  );
}
