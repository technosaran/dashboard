"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { addAlternativeAsset, updateAlternativeAsset, deleteAlternativeAsset, revertLedgerLog } from "./actions";
import { useFinanceData, type FinanceData } from "@/hooks/use-finance-data";
import { format } from "date-fns";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Drawer } from "@/components/ui/drawer";
import PnLValue from "@/components/pnl-value";

import dynamic from "next/dynamic";
const ResponsiveContainer = dynamic(() => import("recharts").then((mod) => mod.ResponsiveContainer), { ssr: false });
import { BarChart, Bar, PieChart, Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from "recharts";

import AlternativeAssetsDataTable from "./components/AlternativeAssetsDataTable";

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
  const [showAddModal, setShowAddModal] = useState(searchParams?.get("action") === "new");
  const [submitting, withLock] = useSubmitLock();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "inventory" | "history">("overview");

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const assetLogs = useMemo(() => {
    return ledgerLogs
      .filter(log => log.details?.toLowerCase().includes("asset") || log.details?.toLowerCase().includes("physical asset"))
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [ledgerLogs]);

  const [formData, setFormData] = useState({
    name: "", category: "Real Estate", purchase_price: "", current_value: "",
    purchase_date: "", notes: "", account_id: "",
  });

  const stats = useMemo(() => {
    const totalValue = alternativeAssets.reduce((s, a) => s + Number(a.current_value), 0);
    const totalCost = alternativeAssets.reduce((s, a) => s + Number(a.purchase_price), 0);
    const netGrowth = totalValue - totalCost;
    const growthPercent = totalCost > 0 ? (netGrowth / totalCost) * 100 : 0;
    return { totalValue, totalCost, netGrowth, growthPercent };
  }, [alternativeAssets]);

  const pieChartData = useMemo(() => {
    const map: Record<string, number> = {};
    alternativeAssets.forEach(a => {
      map[a.category] = (map[a.category] || 0) + Number(a.current_value);
    });
    return Object.entries(map).map(([name, value], idx) => {
      const colors = ["#06B6D4", "#F97316", "#8B5CF6", "#22C55E", "#EC4899", "#EAB308", "#3B82F6"];
      return { name, value, fill: colors[idx % colors.length] };
    });
  }, [alternativeAssets]);

  const barChartData = useMemo(() => {
    return [...alternativeAssets].sort((a, b) => Number(b.current_value) - Number(a.current_value)).slice(0, 10).map(a => ({
      name: a.name.length > 15 ? a.name.substring(0, 15) + '...' : a.name,
      Cost: Number(a.purchase_price),
      Value: Number(a.current_value)
    }));
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

  const startEdit = (id: string) => {
    const asset = alternativeAssets.find(a => a.id === id);
    if (!asset) return;
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
  };

  async function handleDeleteAsset(id: string, name: string) {
    if (!confirm(`Permanently delete this asset record: "${name}"?`)) return;
    await withLock(async () => {
      const res = await deleteAlternativeAsset(id);
      if (!res.error) {
        toast.success(`Asset deleted`);
        mutate();
      } else toast.error(res.error);
    });
  }

  async function handleRevert(logId: string) {
    if (!confirm("Revert this action? This will undo the ledger entry and any associated balance changes.")) return;
    await withLock(async () => {
      const res = await revertLedgerLog(logId);
      if (!res.error) {
        toast.success("Action reverted successfully");
        mutate();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white uppercase italic">Alternative Assets</h1>
          <p className="text-[10px] text-[--text-muted] font-black uppercase tracking-[0.4em] mt-2 ml-1">Tangible Wealth & Private Holdings</p>
        </div>
        <button type="button" onClick={() => setShowAddModal(true)} disabled={submitting} className="btn-primary !h-11 px-6 shadow-[0_0_30px_rgba(14,165,233,0.3)] text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
          Record Asset
        </button>
      </div>

      {alternativeAssets.length === 0 ? (
        <div className="glass-card-static relative overflow-hidden p-8 md:p-16 text-center flex flex-col items-center justify-center min-h-[450px]">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-[--accent-primary]/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative mb-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[--accent-primary]/15 to-emerald-500/15 border border-[--accent-primary]/25 flex items-center justify-center shadow-[0_0_30px_-5px_rgba(14,165,233,0.3)] animate-pulse">
              <span className="text-3xl">💎</span>
            </div>
          </div>
          <h3 className="text-2xl md:text-3xl font-black text-[--text-primary] tracking-tight">Register Your First Asset</h3>
          <p className="text-sm text-[--text-muted] mt-3 max-w-lg mx-auto font-medium leading-relaxed">Track real estate, gold, collectibles, and other tangible holdings. Build a complete picture of your wealth.</p>
          <div className="mt-8 flex justify-center">
             <button onClick={() => setShowAddModal(true)} className="btn-primary">Record New Asset</button>
          </div>
        </div>
      ) : (
      <>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Asset Valuation</p>
            <p className="text-2xl md:text-3xl font-black text-white">₹{stats.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Total Market Value</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Acquisition Cost</p>
            <p className="text-2xl md:text-3xl font-black text-[--text-secondary]">₹{stats.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Total Invested</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Portfolio Growth</p>
            <PnLValue amount={stats.netGrowth} size="lg" showIcon currency="INR" />
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Absolute Return</p>
          </div>
          <div className="glass-card-static p-6 border-white/5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Yield (ROI)</p>
            <p className={`text-2xl md:text-3xl font-black ${stats.netGrowth >= 0 ? "text-success" : "text-danger"}`}>
              {stats.netGrowth >= 0 ? "+" : ""}{stats.growthPercent.toFixed(2)}%
            </p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Relative Return</p>
          </div>
          <div className="glass-card-static p-6 border-white/5 bg-gradient-to-br from-[--accent-primary]/10 to-transparent">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted] mb-3">Asset Count</p>
            <p className="text-xl md:text-2xl font-black text-white">{alternativeAssets.length}</p>
            <p className="text-[9px] font-bold text-[--text-muted] mt-2 uppercase tracking-widest opacity-60">Active Holdings</p>
          </div>
        </div>

        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 ${
              activeTab === "overview"
                ? "border-[--accent-primary] text-[--accent-primary]"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "inventory"
                ? "border-[--accent-primary] text-[--accent-primary]"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Inventory Directory
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[9px] text-white">
              {alternativeAssets.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-6 py-3 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "history"
                ? "border-[--accent-primary] text-[--accent-primary]"
                : "border-transparent text-[--text-muted] hover:text-white"
            }`}
          >
            Audit History
          </button>
        </div>

        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card-static p-6 min-h-[350px] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted]">Top Assets</h3>
                    <p className="text-2xl font-black mt-2 text-white">Cost vs Current Value</p>
                  </div>
                </div>
                <div className="flex-1 w-full mt-4 -ml-4">
                  {mounted && barChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12 }} tickFormatter={(val: any) => `₹${Number(val).toLocaleString()}`} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                          formatter={(val: any, name: any) => [`₹${Number(val).toLocaleString()}`, name]}
                        />
                        <Legend wrapperStyle={{ paddingTop: "20px" }} />
                        <Bar dataKey="Cost" fill="#64748B" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Value" fill="#14B8A6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-[--text-muted] text-sm italic">No assets</div>
                  )}
                </div>
              </div>

              <div className="glass-card-static p-6 min-h-[350px] flex flex-col items-center justify-center relative">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-[--text-muted] absolute top-6 left-6">Asset Allocation</h3>
                <div className="w-full h-[250px] mt-8">
                  {mounted && pieChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value">
                          {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />)}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: "rgba(10,10,10,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                          itemStyle={{ color: "#fff", fontWeight: "bold" }}
                          formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Value"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[--text-muted]">
                       <span className="text-3xl mb-2">📊</span>
                       <span className="text-xs uppercase tracking-widest font-black">No Data</span>
                    </div>
                  )}
                </div>
                {pieChartData.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-3 mt-4 w-full">
                    {pieChartData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                        <span className="text-[--text-secondary] font-medium">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AlternativeAssetsDataTable 
              assets={alternativeAssets}
              onEdit={startEdit}
              onDelete={handleDeleteAsset}
              onAdd={() => setShowAddModal(true)}
            />
          </div>
        )}

        {activeTab === "history" && (
          <div className="glass-card-static rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-white">Asset Audit Trail</h3>
              <p className="text-[10px] font-black text-[--text-muted] uppercase tracking-widest">{assetLogs.length} Records</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] text-[--text-muted] uppercase font-black tracking-widest bg-black/40">
                    <th className="py-4 px-6">Timestamp</th>
                    <th className="py-4 px-6">Action</th>
                    <th className="py-4 px-6">Details</th>
                    <th className="py-4 px-6 text-right">Amount Impact</th>
                    <th className="py-4 px-6 text-right">Ops</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {assetLogs.map((log) => {
                    const isPositive = log.action_type === "CREATE" || log.action_type === "ADJUST_UP";
                    return (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-4 px-6">
                          <p className="text-[12px] font-bold text-white/80">{log.created_at ? format(new Date(log.created_at), "MMM d, yyyy") : "N/A"}</p>
                          <p className="text-[10px] font-bold text-[--text-muted] mt-0.5">{log.created_at ? format(new Date(log.created_at), "HH:mm:ss") : ""}</p>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                            log.action_type === "CREATE" ? "bg-emerald-500/10 text-emerald-400" :
                            log.action_type === "DELETE" ? "bg-rose-500/10 text-rose-400" :
                            "bg-blue-500/10 text-blue-400"
                          }`}>
                            {log.action_type}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-[12px] font-bold text-white">{log.details}</p>
                        </td>
                        <td className="py-4 px-6 text-right tabular-nums">
                          <p className={`text-[13px] font-black ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                            {log.amount ? `${isPositive ? "+" : "-"}₹${log.amount.toLocaleString()}` : "—"}
                          </p>
                        </td>
                        <td className="py-4 px-6 text-right">
                           <button type="button" 
                             onClick={() => handleRevert(log.id)}
                             disabled={submitting}
                             className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all bg-rose-500/5 px-3 py-1.5 rounded-lg border border-rose-500/10"
                           >
                             Revert
                           </button>
                        </td>
                      </tr>
                    );
                  })}
                  {assetLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-[11px] font-bold text-[--text-muted] uppercase tracking-[0.3em]">No historical records detected</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
      )}

      {showAddModal && (
        <Drawer
          isOpen={showAddModal}
          onClose={() => { setShowAddModal(false); setEditingId(null); }}
          title={editingId ? "Update Asset" : "Establish Asset"}
        >
          <div className="p-2 max-w-lg mx-auto w-full">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Asset Name</label>
                  <input required className="input-premium" placeholder="e.g. 2BHK Apartment" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} autoComplete="new-password" />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Classification</label>
                  <select aria-label="Select asset category" className="input-premium" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
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
                  <select aria-label="Select account" className="input-premium" value={formData.account_id} onChange={e => setFormData({...formData, account_id: e.target.value})}>
                    <option value="">No Transaction</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} (₹{acc.balance.toLocaleString()})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[--text-muted]">Notes / Location</label>
                <textarea className="input-premium min-h-[80px] py-4 resize-none" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} autoComplete="new-password" />
              </div>

              <div className="pt-4">
                <button type="submit" disabled={submitting} className="btn-primary w-full h-12 shadow-xl shadow-[--accent-primary]/20 text-[11px] font-black uppercase tracking-widest">
                  {submitting ? "Processing..." : editingId ? "Update Entry" : "Establish Entry"}
                </button>
              </div>
            </form>
          </div>
        </Drawer>
      )}
    </div>
  );
}
